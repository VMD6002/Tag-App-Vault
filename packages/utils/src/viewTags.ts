export const sortModes = [
  "created-date-asc",
  "created-date-desc",
  "updated-date-asc",
  "updated-date-desc",
  "name-asc",
  "name-desc",
] as const;
export type SortMode = (typeof sortModes)[number];

export const galleryViewModes = [
  "list",
  "responsive",
  "grid-2",
  "grid-3",
  "grid-4",
] as const;
export type GalleryViewMode = (typeof galleryViewModes)[number];

/** Reserved `view:` tag read by `filterLibrary`, not a display option (so not in `VIEW_TAGS`): a grouped item carrying it still shows in the main library (moot when `groupedInLibrary` is "show"). */
export const VIEW_IN_LIBRARY_TAG = "view:in-library";

/** Reserved tag read by `filterLibrary`: the item, or a group card when on the group's own tags, is left out of the main library unless the query's `any`/`all` names this tag. `/group/:id` ignores it. */
export const VIEW_HIDE_IN_LIBRARY_TAG = "view:hide-in-library";

export type ViewTagValues = Partial<{
  sortMode: SortMode;
  viewMode: GalleryViewMode;
  autoPlay: boolean;
  /** Single-column width of the gallery, 10-100 (percent). */
  listWidth: number;
}>;

/** Single source of truth for `view:` tags (documented in docs/domain-model.md). */
export const VIEW_TAGS: Record<string, ViewTagValues> = {
  "view:sort-a-z": { sortMode: "name-asc" },
  "view:sort-z-a": { sortMode: "name-desc" },
  "view:sort-newest": { sortMode: "created-date-desc" },
  "view:sort-oldest": { sortMode: "created-date-asc" },
  "view:sort-modified-newest": { sortMode: "updated-date-desc" },
  "view:sort-modified-oldest": { sortMode: "updated-date-asc" },
  "view:list": { viewMode: "list" },
  "view:grid-auto": { viewMode: "responsive" },
  "view:grid-2": { viewMode: "grid-2" },
  "view:grid-3": { viewMode: "grid-3" },
  "view:grid-4": { viewMode: "grid-4" },
  "view:autoplay": { autoPlay: true },
  "view:no-autoplay": { autoPlay: false },
};

const WIDTH = /^view:width-(\d{2,3})$/;

function parseOne(tag: string): ViewTagValues | undefined {
  const known = VIEW_TAGS[tag];
  if (known) return known;
  const width = Number(WIDTH.exec(tag)?.[1]);
  return width >= 10 && width <= 100 ? { listWidth: width } : undefined;
}

/** Display options from an item's tags. Unknown `view:*` tags are ignored; for conflicting tags of one kind the first in tag order wins. */
export function parseViewTags(tags: readonly string[]): ViewTagValues {
  const out: ViewTagValues = {};
  for (const tag of tags) {
    const values = parseOne(tag);
    for (const key of Object.keys(values ?? {}) as (keyof ViewTagValues)[])
      if (!(key in out)) Object.assign(out, { [key]: values?.[key] });
  }
  return out;
}
