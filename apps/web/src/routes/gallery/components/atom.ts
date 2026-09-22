import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";

export type entry = {
  name: string;
  type: "video" | "img";
  cover?: string;
  createdAt: number;
  modifiedAt: number;
  tags?: string[];
};

export const galleryDataAtom = atom<entry[]>([]);

export const autoPlayFamily = atomFamily((id: string) =>
  atomWithStorage<boolean>(`gallery_autoPlay_${id}`, false),
);

export const currentModeAtom = atom<"view" | "cover" | "delete">("view");

export const selectedContentAtom = atom<string[]>([]);

export const sortModes = [
  "created-date-asc",
  "created-date-desc",
  "updated-date-asc",
  "updated-date-desc",
  "name-asc",
  "name-desc",
] as const;
export type SortMode = (typeof sortModes)[number];
export const sortModeFamily = atomFamily((id: string) =>
  atomWithStorage<SortMode>(`gallery_sortMode_${id}`, "created-date-asc"),
);

export const galleryViewModes = [
  "list",
  "responsive",
  "grid-2",
  "grid-3",
  "grid-4",
] as const;
export type GalleryViewMode = (typeof galleryViewModes)[number];
export const galleryViewModeFamily = atomFamily((id: string) =>
  atomWithStorage<GalleryViewMode>(`gallery_viewMode_${id}`, "responsive"),
);

export const galleryListWidthFamily = atomFamily((id: string) =>
  atomWithStorage<number>(`gallery_listWidth_${id}`, 100),
);

export const tagModalOpenAtom = atom<boolean>(false);
export const tagModalDataAtom = atom<entry | null>(null);
