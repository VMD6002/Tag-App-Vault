import { type Atom, atom } from "jotai";
import { atomWithStorage, type RESET } from "jotai/utils";
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

/** Device-local defaults (Settings page) for galleries that have no choice of their own. */
export const defaultAutoPlayAtom = atomWithStorage<boolean>(
  "gallery_default_autoPlay",
  false,
);
export const defaultSortModeAtom = atomWithStorage<SortMode>(
  "gallery_default_sortMode",
  "name-asc",
);
export const defaultViewModeAtom = atomWithStorage<GalleryViewMode>(
  "gallery_default_viewMode",
  "responsive",
);
export const defaultListWidthAtom = atomWithStorage<number>(
  "gallery_default_listWidth",
  100,
);

/** Per-gallery option: `null` in storage means "follow the default"; RESET clears the override. */
const galleryOption = <T>(key: string, fallback: Atom<T>) =>
  atomFamily((id: string) => {
    const own = atomWithStorage<T | null>(`${key}_${id}`, null);
    return atom(
      (get) => get(own) ?? get(fallback),
      (_get, set, value: T | typeof RESET) => set(own, value),
    );
  });

export const autoPlayFamily = galleryOption(
  "gallery_autoPlay",
  defaultAutoPlayAtom,
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
export const sortModeFamily = galleryOption(
  "gallery_sortMode",
  defaultSortModeAtom,
);

export const galleryViewModes = [
  "list",
  "responsive",
  "grid-2",
  "grid-3",
  "grid-4",
] as const;
export type GalleryViewMode = (typeof galleryViewModes)[number];
export const galleryViewModeFamily = galleryOption(
  "gallery_viewMode",
  defaultViewModeAtom,
);

export const galleryListWidthFamily = galleryOption(
  "gallery_listWidth",
  defaultListWidthAtom,
);

export const tagModalOpenAtom = atom<boolean>(false);
export const tagModalDataAtom = atom<entry | null>(null);
