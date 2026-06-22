import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface entry {
  name: string;
  type: "video" | "img";
  createdAt: number;
  modifiedAt: number;
  cover?: string;
}

export const galleryDataAtom = atom<entry[]>([]);

export type SortMode =
  | "created-date-asc"
  | "created-date-desc"
  | "updated-date-asc"
  | "updated-date-desc"
  | "name-asc"
  | "name-desc";

export const sortModes: SortMode[] = [
  "created-date-asc",
  "created-date-desc",
  "updated-date-asc",
  "updated-date-desc",
  "name-asc",
  "name-desc",
];

export const sortModeAtom = atom<SortMode>("created-date-asc");

export const autoPlayAtom = atom(false);

export const currentModeAtom = atom<"view" | "cover" | "delete">("view");

export const selectedContentAtom = atom<string[]>([]);

export const galleryViewModes = ["list", "grid-2", "grid-3", "grid-4"] as const;
export type GalleryViewMode = (typeof galleryViewModes)[number];
export const galleryViewModeAtom = atomWithStorage<GalleryViewMode>(
  "galleryViewMode",
  "list",
);
export const galleryListWidthAtom = atomWithStorage<number>(
  "galleryListWidth",
  100,
);
