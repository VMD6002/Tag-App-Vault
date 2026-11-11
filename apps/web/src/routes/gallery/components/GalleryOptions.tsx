import { useAtom, useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import { Funnel } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useDoc } from "@/routes/contexts/Doc.Context";
import {
  autoPlayFamily,
  type GalleryViewMode,
  galleryDataAtom,
  galleryListWidthFamily,
  galleryViewModeFamily,
  galleryViewModes,
  type SortMode,
  sortModeFamily,
  sortModes,
} from "./atom";
import GalleryFilters from "./GalleryFilters";
import { sortLabels, viewLabels } from "./labels";
import type { GalleryFilter } from "./useGalleryFilter";

export default function GalleryOptions({ filter }: { filter: GalleryFilter }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const total = useAtomValue(galleryDataAtom).length;
  const {
    doc: { id },
  } = useDoc();
  const [autoPlay, setAutoPlay] = useAtom(autoPlayFamily(id));
  const [sortMode, setSortMode] = useAtom(sortModeFamily(id));
  const [galleryViewMode, setGalleryViewMode] = useAtom(
    galleryViewModeFamily(id),
  );
  const [listWidth, setListWidth] = useAtom(galleryListWidthFamily(id));
  const resetAll = () => {
    setAutoPlay(RESET);
    setSortMode(RESET);
    setGalleryViewMode(RESET);
    setListWidth(RESET);
  };

  return (
    <div className="sticky top-14 z-10 mb-4 border-b bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Sort by</Label>
          <Select
            value={sortMode}
            items={sortLabels}
            onValueChange={(selected) =>
              selected && setSortMode(selected as SortMode)
            }
          >
            <SelectTrigger className="w-48" aria-label="Sort by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {sortModes.map((mode) => (
                  <SelectItem key={`Select-${mode}`} value={mode}>
                    {sortLabels[mode]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Layout</Label>
          <Select
            value={galleryViewMode}
            items={viewLabels}
            onValueChange={(selected) =>
              selected && setGalleryViewMode(selected as GalleryViewMode)
            }
          >
            <SelectTrigger className="w-40" aria-label="Layout">
              <SelectValue placeholder="Layout" />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {galleryViewModes.map((mode) => (
                  <SelectItem key={`Select-${mode}`} value={mode}>
                    {viewLabels[mode]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={autoPlay ? "default" : "outline"}
          aria-pressed={autoPlay}
          onClick={() => setAutoPlay(!autoPlay)}
          title="On: videos play right in the gallery. Off: videos that have a cover show it instead."
        >
          Autoplay videos: {autoPlay ? "on" : "off"}
        </Button>
        <Button
          variant="ghost"
          onClick={resetAll}
          title="Forget this gallery's own choices and follow its view: tags, or the defaults from Settings."
        >
          Reset
        </Button>
        <Link
          href="/reference"
          className="pb-2 text-xs text-muted-foreground underline underline-offset-4"
          title="Which tags set a gallery's sort, layout, width and autoplay, and what wins"
        >
          Tag shortcuts
        </Link>
        <Button
          variant={filtersOpen ? "default" : "outline"}
          aria-pressed={filtersOpen}
          aria-label="Filter files"
          onClick={() => setFiltersOpen((o) => !o)}
          title="Search these files by name, type and tags"
        >
          <Funnel />
          Filter
          {!filtersOpen && filter.activeCount > 0 && (
            <Badge variant="secondary">{filter.activeCount}</Badge>
          )}
        </Button>
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground tabular-nums sm:ml-auto"
        >
          {filter.activeCount > 0
            ? `${filter.filtered.length} of ${total} files`
            : `${total} files`}
        </p>
      </div>
      {galleryViewMode === "list" && (
        <div className="mt-2 flex items-center gap-3">
          <Label
            id="gallery-width-label"
            className="shrink-0 text-xs text-muted-foreground"
          >
            Column width
          </Label>
          <Slider
            aria-labelledby="gallery-width-label"
            className="flex-1"
            value={[Number(listWidth)]}
            onValueChange={(o) => setListWidth([o].flat()[0])}
            max={100}
            step={1}
          />
        </div>
      )}
      {filtersOpen && (
        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          <GalleryFilters filter={filter} />
        </div>
      )}
    </div>
  );
}
