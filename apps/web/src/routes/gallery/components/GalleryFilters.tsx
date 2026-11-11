import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { typeInfo } from "@/components/craft/library/ContentCard";
import TagFilterFields from "@/components/craft/library/TagFilterFields";
import { galleryDataAtom } from "./atom";
import type { GalleryFilter } from "./useGalleryFilter";

const typeOptions = (["img", "video"] as const).map((o) => ({
  label: typeInfo[o].label,
  value: o,
}));

/** Filter panel whose tag options are the tags present in this gallery's files. */
export default function GalleryFilters({ filter }: { filter: GalleryFilter }) {
  const galleryData = useAtomValue(galleryDataAtom);
  const tags = useMemo(
    () => [...new Set(galleryData.flatMap((e) => e.tags ?? []))].sort(),
    [galleryData],
  );
  return (
    <TagFilterFields filter={filter} tags={tags} typeOptions={typeOptions} />
  );
}
