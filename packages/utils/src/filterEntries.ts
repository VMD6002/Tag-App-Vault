import Fuse from "fuse.js";
import { ArrayHasAll, ArrayHasAnyModified } from "./ArrayHelperFunctions";
import type { FilterQueryType } from "./filterData";

/** `filterData` for items that are not library content (e.g. a gallery's files): same tag, type and name-search rules, keeps input order. */
export function filterEntries<
  T extends { name: string; type: string; tags?: string[] },
>(
  { any, all, none, search, types }: Omit<FilterQueryType, "orderByLatest">,
  entries: T[],
): T[] {
  const results = entries.filter((e) => {
    const tags = e.tags ?? [];
    if (types.length && !types.includes(e.type)) return false;
    if (any.length && !ArrayHasAnyModified(tags, any)) return false;
    if (none.length && ArrayHasAnyModified(tags, none)) return false;
    return ArrayHasAll(tags, all);
  });
  return search.trim()
    ? new Fuse(results, {
        keys: ["name"],
        threshold: 0.5,
        shouldSort: false,
      })
        .search(search)
        .map((r) => r.item)
    : results;
}
