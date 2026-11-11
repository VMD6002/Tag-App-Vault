import { VIEW_IN_LIBRARY_TAG, VIEW_TAGS } from "./viewTags";

export const CAPTION_TAG = "meta:caption";
export const YT_COOKIE_TAG = "meta:yt-cookie";
export const DIFFERENT_COVER_TAG = "meta:different-cover";

/** Single source of truth for tags the system reads (documented in docs/domain-model.md). */
export const RESERVED_TAGS: readonly string[] = [
  CAPTION_TAG,
  YT_COOKIE_TAG,
  DIFFERENT_COVER_TAG,
  ...Object.keys(VIEW_TAGS),
  VIEW_IN_LIBRARY_TAG,
  // The parser accepts any 10..100; the list offers steps of 10.
  ...Array.from({ length: 10 }, (_, i) => `view:width-${(i + 1) * 10}`),
];

/** `tags` plus every reserved tag not already in it; `tags` keeps its order. */
export const withReservedTags = (tags: readonly string[]): string[] => [
  ...new Set([...tags, ...RESERVED_TAGS]),
];
