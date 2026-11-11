import { atom } from "jotai";
import type { MultiSelectOption } from "@/atom";

// Fixed
export const updateIdAtom = atom("");

// Lading State
export const updateInputDisabledAtom = atom(false);

// Editable
export const updateModalOpenAtom = atom(false);
export const updateTitleAtom = atom("");
export const updateCoverAtom = atom<string | undefined>(undefined);
export const updateTagsAtom = atom<MultiSelectOption[]>([]);
export const updateExtraDataAtom = atom("");
/** Pending group ids of the item: set when the modal opens, sent with Save (`[]` clears them), dropped on Cancel. */
export const updateGroupsAtom = atom<string[]>([]);

// Optionaly Rendered
export const updateContentUrlAtom = atom<string | undefined>(undefined);

export const updateDataAtom = atom((get) => ({
  id: get(updateIdAtom),
  title: get(updateTitleAtom),
  tags: get(updateTagsAtom).map((o) => o.value),
  cover: get(updateCoverAtom),
  contentUrl: get(updateContentUrlAtom),
  extraData: get(updateExtraDataAtom),
  groups: get(updateGroupsAtom),
}));

export const updateExistsAtom = atom(true);

export const updateResetOptionsAtom = atom<{
  title?: () => string;
  cover?: () => string;
  tags?: () => MultiSelectOption[];
  contentUrl?: () => string;
  preset?: () => { label: string; value: string } | undefined;
  extraData?: () => string;
} | null>(null);
