import { atom } from "jotai";
import type { MultiSelectOption } from "@/atom";

export const selectionOnAtom = atom(false);
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
});

export const selectAllAtom = atom(null, (get, set, filtered: string[]) => {
  set(selectionEntriesAtom, filtered);
});

export const unSelectAllAtom = atom(null, (get, set) => {
  set(selectionEntriesAtom, []);
});
