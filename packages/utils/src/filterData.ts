import { ArrayHasAll, ArrayHasAnyModified } from "@tagapp/utils";
import type {
  ContentServerDataType,
  ContentServerType,
  GroupsDB,
  GroupType,
} from "@tagapp/utils/types";
import { GroupedInLibrarySchema, GroupSortSchema } from "@tagapp/utils/types";
import Fuse from "fuse.js";
import z from "zod";
import { childrenByGroup, groupSortKey } from "./groups";
import { VIEW_HIDE_IN_LIBRARY_TAG, VIEW_IN_LIBRARY_TAG } from "./viewTags";

export const FilterQuerySchema = z.object({
  any: z.string().array(), // 1st array - content with at least one of these tags
  all: z.string().array(), // 2nd array - content with all these tags
  none: z.string().array(), // 3rd array - content without any of these tags
  search: z.string(), // string for title search
  types: z.string().array(), // array of types to include (e.g., ["img", "video"])
  orderByLatest: z.boolean(),
  // Groups (used by `filterLibrary` only). Optional, so other callers keep today's behaviour.
  showGrouped: z.boolean().optional(), // list every grouped item, not only `view:in-library` ones
  itemsOnly: z.boolean().optional(), // advanced search mode 2: items only, no group cards
  ignoreHidden: z.boolean().optional(), // `/group/:id`: do not apply `view:hide-in-library`
  searchDescription: z.boolean().optional(), // search `extraData` too
  groupSort: GroupSortSchema.optional(), // default "newestChild"
  groupedInLibrary: GroupedInLibrarySchema.optional(), // default "hide"; "show": grouped items show like any item
});

export type FilterQueryType = z.infer<typeof FilterQuerySchema>;

function GetSearchIds<T extends { title: string; extraData: string }>(
  ids: T[],
  search: string,
  description = false,
) {
  const fuse = new Fuse(ids, {
    keys: description ? ["title", "extraData"] : ["title"],
    threshold: 0.5,
    shouldSort: false,
  });
  const fuseResults = fuse.search(search);
  const finalResults = fuseResults.map((fuseObj) => fuseObj.item);
  return finalResults;
}

export function filterData(
  filterData: FilterQueryType,
  contentData: ContentServerDataType,
) {
  const { any, all, none, search, types, orderByLatest } = filterData;
  const hasAny = !!any?.length;
  const hasAll = !!all?.length;
  const hasNone = !!none?.length;
  const allTypes = !types.length;

  const results: ContentServerType[] = [];

  for (const item of Object.values(contentData)) {
    if (!allTypes && !types.includes(item.type)) continue;
    const tags = item.tags;

    // apply all filters in one pass
    if (hasAny && !ArrayHasAnyModified(tags, any)) continue;
    if (hasNone && ArrayHasAnyModified(tags, none)) continue;
    if (hasAll && !ArrayHasAll(tags, all)) continue;

    results.push(item);
  }

  // run search last (expensive)
  const preFinalResult =
    search && search.trim().length > 0
      ? GetSearchIds(results, search)
      : results;

  const finalResult = orderByLatest
    ? preFinalResult.sort((a, b) => b.added - a.added)
    : preFinalResult.sort((a, b) => a.added - b.added);

  return finalResult;
}

/** One row of the library list: an item, or a group card with all its children. */
export type LibraryEntry =
  | { kind: "item"; item: ContentServerType }
  | { kind: "group"; group: GroupType; children: ContentServerType[] };

/**
 * Library rows for a query: items and group cards, sorted together (`docs/groups.md`).
 *
 * - A grouped item (a group id that has a record in `groups`) is hidden unless it has
 *   `view:in-library` or `showGrouped`/`itemsOnly` is on, or `groupedInLibrary` is "show" (then
 *   only `view:hide-in-library` hides it, like any item).
 * - An item, or a group card (the group's own tags), with `view:hide-in-library` is dropped (both
 *   modes) unless `any` or `all` contains that tag exactly, or `ignoreHidden` is on (group pages).
 *   Children of a hidden card follow the grouped-item rule above.
 * - Mode 1 (default): items and group cards, searched by title. Mode 2 (`itemsOnly`): every item,
 *   grouped or not, searched directly, no cards. `searchDescription` adds `extraData` to the
 *   searched fields in either mode.
 * - A card passes `none` on its own tags only; `any`/`all` on its own tags or on any single child's
 *   tags; `types` when some child has one of the types. Groups without children never appear.
 * - Cards sort by `groupSort`, items by `added`; ties keep items before cards.
 */
export function filterLibrary(
  query: FilterQueryType,
  contentData: ContentServerDataType,
  groups: GroupsDB = {},
) {
  const {
    any,
    all,
    none,
    search,
    types,
    orderByLatest,
    showGrouped,
    itemsOnly,
    searchDescription,
    groupSort,
    groupedInLibrary,
    ignoreHidden,
  } = query;
  const hasAny = !!any?.length;
  const hasAll = !!all?.length;
  const hasNone = !!none?.length;
  const allTypes = !types.length;
  const positive = (tags: string[]) =>
    (!hasAny || ArrayHasAnyModified(tags, any)) &&
    (!hasAll || ArrayHasAll(tags, all));
  const notExcluded = (tags: string[]) =>
    !hasNone || !ArrayHasAnyModified(tags, none);
  const hiddenOk =
    ignoreHidden ||
    !!any?.includes(VIEW_HIDE_IN_LIBRARY_TAG) ||
    !!all?.includes(VIEW_HIDE_IN_LIBRARY_TAG);
  const itemShown = (c: ContentServerType) =>
    (hiddenOk || !c.tags.includes(VIEW_HIDE_IN_LIBRARY_TAG)) &&
    (itemsOnly ||
      showGrouped ||
      groupedInLibrary === "show" ||
      !c.groups?.some((id) => groups[id]) ||
      c.tags.includes(VIEW_IN_LIBRARY_TAG));

  let items = Object.values(contentData).filter(
    (c) =>
      (allTypes || types.includes(c.type)) &&
      itemShown(c) &&
      notExcluded(c.tags) &&
      positive(c.tags),
  );

  // shortcut: children are recomputed from the full content record per call; revisit at ~20k items.
  const children = childrenByGroup(contentData);
  let cards = itemsOnly
    ? []
    : Object.values(groups).filter((g) => {
        const kids = children[g.id];
        if (!kids?.length || !notExcluded(g.tags)) return false;
        if (!hiddenOk && g.tags.includes(VIEW_HIDE_IN_LIBRARY_TAG))
          return false;
        if (!allTypes && !kids.some((c) => types.includes(c.type)))
          return false;
        return (
          (!hasAny && !hasAll) ||
          positive(g.tags) ||
          kids.some((c) => positive(c.tags))
        );
      });

  // run search last (expensive)
  if (search.trim()) {
    items = GetSearchIds(items, search, searchDescription);
    cards = GetSearchIds(cards, search, searchDescription);
  }

  const entries: LibraryEntry[] = [
    ...items.map((item) => ({ kind: "item" as const, item })),
    ...cards.map((group) => ({
      kind: "group" as const,
      group,
      children: children[group.id] ?? [],
    })),
  ];
  const key = (e: LibraryEntry) =>
    e.kind === "item"
      ? e.item.added
      : groupSortKey(e.group, e.children, groupSort);
  // Array.sort is stable: equal keys keep items before cards.
  return entries.sort((a, b) =>
    orderByLatest ? key(b) - key(a) : key(a) - key(b),
  );
}
