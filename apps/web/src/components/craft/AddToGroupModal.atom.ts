import { atom } from "jotai";

/** Ids of the items to add to groups; `null` keeps the modal closed. Set it to open `AddToGroupModal`. */
export const addToGroupAtom = atom<string[] | null>(null);
