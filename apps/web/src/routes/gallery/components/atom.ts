import {
  type GalleryViewMode,
  galleryViewModes,
  type SortMode,
  sortModes,
  type ViewTagValues,
} from "@tagapp/utils";
import { type Atom, atom } from "jotai";
import { atomWithStorage, type RESET } from "jotai/utils";
import { atomFamily } from "jotai-family";

export { type GalleryViewMode, galleryViewModes, type SortMode, sortModes };

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

/** `view:` tag values of a gallery, set by the gallery page from the item's tags. */
export const viewTagsFamily = atomFamily((_id: string) =>
  atom<ViewTagValues>({}),
);

/** Per-gallery option, read as own choice > `view:` tag > default. `null` in storage means no own choice; RESET clears it. */
const galleryOption = <T>(
  key: string,
  tagKey: keyof ViewTagValues,
  fallback: Atom<T>,
) =>
  atomFamily((id: string) => {
    const own = atomWithStorage<T | null>(`${key}_${id}`, null);
    return atom(
      (get) =>
        get(own) ??
        (get(viewTagsFamily(id))[tagKey] as T | undefined) ??
        get(fallback),
      (_get, set, value: T | typeof RESET) => set(own, value),
    );
  });

export const autoPlayFamily = galleryOption(
  "gallery_autoPlay",
  "autoPlay",
  defaultAutoPlayAtom,
);

export const currentModeAtom = atom<"view" | "cover" | "delete">("view");

export const selectedContentAtom = atom<string[]>([]);

export const sortModeFamily = galleryOption(
  "gallery_sortMode",
  "sortMode",
  defaultSortModeAtom,
);

export const galleryViewModeFamily = galleryOption(
  "gallery_viewMode",
  "viewMode",
  defaultViewModeAtom,
);

export const galleryListWidthFamily = galleryOption(
  "gallery_listWidth",
  "listWidth",
  defaultListWidthAtom,
);

export const tagModalOpenAtom = atom<boolean>(false);
export const tagModalDataAtom = atom<entry | null>(null);
