import type { GroupedInLibraryType, GroupSortType } from "@tagapp/utils/types";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disable?: boolean;
  /** fixed option that can't be removed. */
  fixed?: boolean;
  /** Group the options by providing key. */
  [key: string]: string | boolean | undefined;
}

type Theme = "dark" | "light" | "system";

export const themeAtom = atomWithStorage<Theme>("vite-ui-theme", "system");

export const searchAtom = atom("");
export const allAtom = atom<MultiSelectOption[]>([]);
export const anyAtom = atom<MultiSelectOption[]>([]);
export const noneAtom = atom<MultiSelectOption[]>([]);
export const typesAtom = atom<MultiSelectOption[]>([]);
export const orderByLatestAtom = atom(true);
/** Show every grouped item, not only the ones tagged `view:in-library`. */
export const showGroupedAtom = atom(false);
/** Advanced search mode 2: items only, no group cards (mode 1, groups and items, is the default). */
export const itemsOnlyAtom = atom(false);
/** Search item and group descriptions too. */
export const searchDescriptionAtom = atom(false);

/** Device-local (Settings page): where group cards sit among items in the library. */
export const groupSortAtom = atomWithStorage<GroupSortType>(
  "group_sort",
  "newestChild",
);

/** Device-local (Settings page): grouped items hidden from the library unless `view:in-library` ("hide", default), or shown like any item ("show"). */
export const groupedInLibraryAtom = atomWithStorage<GroupedInLibraryType>(
  "grouped_in_library",
  "hide",
);

/** Live re-filtering on every change instead of the Filter button. */
export const realtimeFilterAtom = atomWithStorage("realtime-filter", false);

export const FilterQueryAtom = atom((get) => ({
  search: get(searchAtom),
  all: get(allAtom).map((o) => o.value),
  any: get(anyAtom).map((o) => o.value),
  none: get(noneAtom).map((o) => o.value),
  types: get(typesAtom).map((o) => o.value),
  orderByLatest: get(orderByLatestAtom),
  showGrouped: get(showGroupedAtom),
  itemsOnly: get(itemsOnlyAtom),
  searchDescription: get(searchDescriptionAtom),
  groupSort: get(groupSortAtom),
  groupedInLibrary: get(groupedInLibraryAtom),
}));

/** True when a search, type or tag filter is set (tells "empty library" from "no results"). */
export const filterActiveAtom = atom(
  (get) =>
    !!get(searchAtom).trim() ||
    get(allAtom).length > 0 ||
    get(anyAtom).length > 0 ||
    get(noneAtom).length > 0 ||
    get(typesAtom).length > 0 ||
    get(showGroupedAtom) ||
    get(itemsOnlyAtom) ||
    get(searchDescriptionAtom),
);

export const injectFilterDataIntoURLAtom = atom(
  null,
  (get, _, replace?: boolean) => {
    const fd = get(FilterQueryAtom);
    const url = new URL(location.href);
    const params = url.searchParams;

    if (fd.any.length) params.set("any", fd.any.join(","));
    else params.delete("any");

    if (fd.none.length) params.set("none", fd.none.join(","));
    else params.delete("none");

    if (fd.all.length) params.set("all", fd.all.join(","));
    else params.delete("all");

    if (fd.types.length) params.set("types", fd.types.join(","));
    else params.delete("types");

    if (fd.search.trim()) params.set("search", fd.search);
    else params.delete("search");

    if (!fd.orderByLatest) params.set("orderByLatest", "false");
    else params.delete("orderByLatest");

    for (const [key, on] of [
      ["showGrouped", fd.showGrouped],
      ["itemsOnly", fd.itemsOnly],
      ["searchDescription", fd.searchDescription],
    ] as const) {
      if (on) params.set(key, "true");
      else params.delete(key);
    }

    // Realtime filtering replaces the entry so typing doesn't flood the history
    if (replace) history.replaceState({}, "", url.toString());
    else history.pushState({}, "", url.toString());
  },
);

export const initializeFilterDataFromURLAtom = atom(null, (_, set) => {
  const url = new URL(location.href);
  const params = url.searchParams;

  const any = params.get("any");
  if (any)
    set(
      anyAtom,
      any.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const none = params.get("none");
  if (none)
    set(
      noneAtom,
      none.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const all = params.get("all");
  if (all)
    set(
      allAtom,
      all.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const types = params.get("types");
  if (types)
    set(
      typesAtom,
      types.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const search = params.get("search");
  if (search) set(searchAtom, search);

  const orderByLatest = params.get("orderByLatest");
  if (orderByLatest) set(orderByLatestAtom, orderByLatest === "true");

  if (params.get("showGrouped") === "true") set(showGroupedAtom, true);
  if (params.get("itemsOnly") === "true") set(itemsOnlyAtom, true);
  if (params.get("searchDescription") === "true")
    set(searchDescriptionAtom, true);
});
export const resetFilterAtom = atom(null, (_, set) => {
  set(searchAtom, "");
  set(allAtom, []);
  set(anyAtom, []);
  set(noneAtom, []);
  set(typesAtom, []);
  set(orderByLatestAtom, true);
  set(showGroupedAtom, false);
  set(itemsOnlyAtom, false);
  set(searchDescriptionAtom, false);
});

/** Clears the filters (atoms and URL) so a page reached from a filtered list starts clean: the query sits before the `#`, so it would otherwise follow the user to the next route. */
export const clearFilterForNavigationAtom = atom(null, (_, set) => {
  set(resetFilterAtom);
  set(injectFilterDataIntoURLAtom, true);
});

export const tagsAtom = atom<string[] | null>(null);

/** Tag -> cover URL sent with the tags by the extension; empty without one (older extensions). */
export const tagCoversAtom = atom<Record<string, string>>({});
