import { filterData } from "@tagapp/utils";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { type MultiSelectOption, realtimeFilterAtom } from "@/atom";
import type { SyncItem } from "./SyncCard";

// Own filter state: the library's atoms and URL query stay untouched
export type Fields = {
  search: string;
  all: MultiSelectOption[];
  any: MultiSelectOption[];
  none: MultiSelectOption[];
  types: MultiSelectOption[];
  orderByLatest: boolean;
};
const NO_FILTER: Fields = {
  search: "",
  all: [],
  any: [],
  none: [],
  types: [],
  orderByLatest: true,
};
const values = (o: MultiSelectOption[]) => o.map((x) => x.value);
const toQuery = (f: Fields) => ({
  ...f,
  all: values(f.all),
  any: values(f.any),
  none: values(f.none),
  types: values(f.types),
});
export const asOptions = (tags: string[]) =>
  tags.map((t) => ({ label: t, value: t }));

/** Client-side filter of the pending items, applied on Filter or (Realtime) 200 ms after a change. */
export function useSyncFilter(contents: Record<string, SyncItem> | undefined) {
  const [realtime, setRealtime] = useAtom(realtimeFilterAtom);
  const [fields, setFields] = useState(NO_FILTER);
  const query = useMemo(() => toQuery(fields), [fields]);
  const [applied, setApplied] = useState(query);

  useEffect(() => {
    if (!realtime) return;
    const timeout = setTimeout(() => setApplied(query), 200);
    return () => clearTimeout(timeout);
  }, [realtime, query]);

  const filtered = useMemo(
    () => filterData(applied, contents ?? {}),
    [applied, contents],
  );

  return {
    fields,
    filtered,
    realtime,
    setRealtime,
    activeCount:
      fields.any.length +
      fields.none.length +
      fields.all.length +
      fields.types.length +
      (fields.search.trim() ? 1 : 0),
    patch: (p: Partial<Fields>) => setFields((f) => ({ ...f, ...p })),
    apply: () => setApplied(query),
    setOrder: (orderByLatest: boolean) => {
      setFields((f) => ({ ...f, orderByLatest }));
      setApplied((q) => ({ ...q, orderByLatest }));
    },
    clear: () => {
      setFields(NO_FILTER);
      setApplied(toQuery(NO_FILTER));
    },
  };
}

export type SyncFilter = ReturnType<typeof useSyncFilter>;
