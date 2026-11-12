import { atom } from "jotai";
import type { MultiSelectOption } from "@/atom";

export const selectionOnAtom = atom(false);
/** `/group/:id` "Choose cover" mode: clicking an item card picks its cover for the group. Exclusive with selection. */
export const coverModeAtom = atom(false);
export const selectionEntriesAtom = atom<string[]>([]);
export const selectionTagsAtom = atom<MultiSelectOption[]>([]);
export const selectionTagsInitialAtom = atom<string[]>([]);

export const selectEntryAtom = atom(null, (get, set, key: string) => {
  const entries = get(selectionEntriesAtom);
  if (entries.includes(key)) {
    set(
      selectionEntriesAtom,
      entries.filter((val) => val !== key),
    );
  } else {
    set(selectionEntriesAtom, [...entries, key]);
  }
});

export const toggleSelectionModeAtom = atom(null, (get, set) => {
  const on = get(selectionOnAtom);
  if (on) set(selectionEntriesAtom, []);
  set(selectionOnAtom, !on);
  set(coverModeAtom, false);
});

export const toggleCoverModeAtom = atom(null, (get, set) => {
  set(selectionEntriesAtom, []);
  set(selectionOnAtom, false);
  set(coverModeAtom, !get(coverModeAtom));
});

export const selectAllAtom = atom(null, (_get, set, filtered: string[]) => {
  set(selectionEntriesAtom, filtered);
});

export const unSelectAllAtom = atom(null, (_get, set) => {
  set(selectionEntriesAtom, []);
});

/** Pre-fills `BulkUpdateModal` with the tags every selected item has; `lists` is the tags of each selected item. */
export const prefillSelectionTagsAtom = atom(
  null,
  (_get, set, lists: string[][]) => {
    const shared = lists
      .slice(1)
      .reduce((a, b) => a.filter((t) => b.includes(t)), lists[0] ?? []);
    set(selectionTagsInitialAtom, shared);
    set(
      selectionTagsAtom,
      shared.map((o) => ({ label: o, value: o })),
    );
  },
);
