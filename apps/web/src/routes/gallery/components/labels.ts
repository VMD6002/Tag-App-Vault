import type { GalleryViewMode, SortMode } from "./atom";

export const sortLabels: Record<SortMode, string> = {
  "name-asc": "Name (A to Z)",
  "name-desc": "Name (Z to A)",
  "created-date-asc": "Created (oldest first)",
  "created-date-desc": "Created (newest first)",
  "updated-date-asc": "Modified (oldest first)",
  "updated-date-desc": "Modified (newest first)",
};

export const viewLabels: Record<GalleryViewMode, string> = {
  list: "Single column",
  responsive: "Auto grid",
  "grid-2": "2 columns",
  "grid-3": "3 columns",
  "grid-4": "4 columns",
};
