import { atom } from "jotai";

export const currentModeAtom = atom<"view" | "cover" | "delete">("view");

export const selectedContentAtom = atom<string[]>([]);

export const currentAtom = atom("");

export type AudioEntry = {
  name: string;
  cover?: string;
};

export const audiosAtom = atom<AudioEntry[]>([]);
