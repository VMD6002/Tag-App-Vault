import type { ContentServerType } from "@tagapp/utils/types";
import { atom } from "jotai";

export const filteredAtom = atom<ContentServerType[]>([]);

export const serverTagsAtom = atom<string[]>([]);
