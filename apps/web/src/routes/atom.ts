import type { ContentServerType } from "@tagapp/utils/types";
import { atom } from "jotai";

/** The whole library, filtered in the browser into `filteredAtom`. */
export const allContentAtom = atom<ContentServerType[]>([]);

export const filteredAtom = atom<ContentServerType[]>([]);

export const serverTagsAtom = atom<string[]>([]);
