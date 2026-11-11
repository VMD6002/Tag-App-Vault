import { filterEntries } from "@tagapp/utils";
import { useAtomValue } from "jotai";
import { useFilterState } from "@/hooks/useFilterState";
import type { entry } from "./atom";
import { galleryDataAtom } from "./atom";

const run = (q: Parameters<typeof filterEntries>[0], entries: entry[]) =>
  filterEntries(q, entries);

/** Filters this gallery's files (search by name, type, tags); state is local to the page. */
export function useGalleryFilter() {
  return useFilterState(useAtomValue(galleryDataAtom), run);
}

export type GalleryFilter = ReturnType<typeof useGalleryFilter>;
