import { useAtom } from "jotai";
import TitleHeader from "@/components/craft/TitleHeader";
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
import { Switch } from "@/components/ui/switch";
import {
  defaultAutoPlayAtom,
  defaultListWidthAtom,
  defaultSortModeAtom,
  defaultViewModeAtom,
  type GalleryViewMode,
  galleryViewModes,
  type SortMode,
  sortModes,
} from "./gallery/components/atom";
import { sortLabels, viewLabels } from "./gallery/components/labels";

export default function SettingsPage() {
  const [sortMode, setSortMode] = useAtom(defaultSortModeAtom);
  const [viewMode, setViewMode] = useAtom(defaultViewModeAtom);
  const [autoPlay, setAutoPlay] = useAtom(defaultAutoPlayAtom);
  const [listWidth, setListWidth] = useAtom(defaultListWidthAtom);

  return (
    <>
      <TitleHeader
        Title="Settings"
        description="Defaults for gallery pages, kept in this browser only. A gallery you changed yourself keeps its own choice until you reset it there."
      />
      <section className="mb-10 grid max-w-md gap-5">
        <div className="grid gap-1.5">
          <Label>Sort by</Label>
          <Select
            value={sortMode}
            items={sortLabels}
            onValueChange={(v) => v && setSortMode(v as SortMode)}
          >
            <SelectTrigger className="w-56" aria-label="Default sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {sortModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {sortLabels[mode]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Layout</Label>
          <Select
            value={viewMode}
            items={viewLabels}
            onValueChange={(v) => v && setViewMode(v as GalleryViewMode)}
          >
            <SelectTrigger className="w-56" aria-label="Default layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {galleryViewModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {viewLabels[mode]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label id="default-width-label">
            Single column width: {listWidth}%
          </Label>
          <Slider
            aria-labelledby="default-width-label"
            value={[listWidth]}
            onValueChange={(o) => setListWidth([o].flat()[0])}
            max={100}
            step={1}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="default-autoplay"
            checked={autoPlay}
            onCheckedChange={setAutoPlay}
          />
          <Label htmlFor="default-autoplay">Autoplay videos in galleries</Label>
        </div>
      </section>
    </>
  );
}
