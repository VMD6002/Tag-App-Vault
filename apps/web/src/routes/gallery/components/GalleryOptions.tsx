import { useAtom, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
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
import { useDoc } from "@/routes/contexts/Doc.Context";
import {
  autoPlayFamily,
  type GalleryViewMode,
  galleryListWidthFamily,
  galleryViewModeFamily,
  galleryViewModes,
  type SortMode,
  sortModeFamily,
  sortModes,
} from "./atom";
import { sortLabels, viewLabels } from "./labels";

export default function GalleryOptions() {
  const {
    doc: { id },
  } = useDoc();
  const [autoPlay, setAutoPlay] = useAtom(autoPlayFamily(id));
  const [sortMode, setSortMode] = useAtom(sortModeFamily(id));
  const [galleryViewMode, setGalleryViewMode] = useAtom(
    galleryViewModeFamily(id),
  );
  const resetWidth = useSetAtom(galleryListWidthFamily(id));
  const resetAll = () => {
    setAutoPlay(RESET);
    setSortMode(RESET);
    setGalleryViewMode(RESET);
    resetWidth(RESET);
  };

  return (
    <div className="sticky top-14 z-10 mb-4 flex flex-wrap items-end gap-x-4 gap-y-2 border-b bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
        title="Forget this gallery's own choices and follow the defaults from Settings."
      >
        Reset to defaults
      </Button>
    </div>
  );
}
