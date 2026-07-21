import { atom } from "jotai";

export interface MultiSelectOption {
  value: string;
  label: string;
  disable?: boolean;
  /** fixed option that can't be removed. */
  fixed?: boolean;
  /** Group the options by providing key. */
  [key: string]: string | boolean | undefined;
}

export const searchAtom = atom("");
export const allAtom = atom<MultiSelectOption[]>([]);
export const anyAtom = atom<MultiSelectOption[]>([]);
export const noneAtom = atom<MultiSelectOption[]>([]);
export const typesAtom = atom<MultiSelectOption[]>([]);
export const orderByLatestAtom = atom(true);

export const FilterQueryAtom = atom((get) => ({
  search: get(searchAtom),
  all: get(allAtom).map((o) => o.value),
  any: get(anyAtom).map((o) => o.value),
  none: get(noneAtom).map((o) => o.value),
  types: get(typesAtom).map((o) => o.value),
  orderByLatest: get(orderByLatestAtom),
}));

export const injectFilterDataIntoURLAtom = atom(null, (get) => {
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

  history.pushState({}, "", url.toString());
});

export const initializeFilterDataFromURLAtom = atom(null, (_, set) => {
  const url = new URL(location.href);
  const params = url.searchParams;

  const any = params.get("any");
  if (any)
    set(
      anyAtom,
      any!.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const none = params.get("none");
  if (none)
    set(
      noneAtom,
      none!.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const all = params.get("all");
  if (all)
    set(
      allAtom,
      all!.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const types = params.get("types");
  if (types)
    set(
      typesAtom,
      types!.split(",").map((tag) => ({ value: tag, label: tag })),
    );

  const search = params.get("search");
  if (search) set(searchAtom, search!);

  const orderByLatest = params.get("orderByLatest");
  if (orderByLatest) set(orderByLatestAtom, orderByLatest === "true");
});
export const resetFilterAtom = atom(null, (_, set) => {
  set(searchAtom, "");
  set(allAtom, []);
  set(anyAtom, []);
  set(noneAtom, []);
  set(typesAtom, []);
  set(orderByLatestAtom, true);
});

export const tagsAtom = atom<string[] | null>(null);
