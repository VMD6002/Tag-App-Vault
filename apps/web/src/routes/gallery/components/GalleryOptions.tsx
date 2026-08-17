import { useAtom } from "jotai";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  autoPlayFamily,
  type SortMode,
  sortModeFamily,
  sortModes,
  galleryViewModeFamily,
  galleryViewModes,
  type GalleryViewMode,
} from "./atom";
import { useDoc } from "@/routes/contexts/Doc.Context";

export default function GalleryOptions() {
  const {
    doc: { id },
  } = useDoc();
  const [autoPlay, setAutoPlay] = useAtom(autoPlayFamily(id));
  const [sortMode, setSortMode] = useAtom(sortModeFamily(id));
  const [galleryViewMode, setGalleryViewMode] = useAtom(
    galleryViewModeFamily(id),
  );

  return (
    <div className="w-full flex flex-col sm:flex-row mb-10">
      <Select
        value={sortMode}
        onValueChange={(selected) => setSortMode(selected as SortMode)}
      >
        <SelectTrigger className="flex-1 w-full rounded-b-none sm:rounded sm:rounded-r-none">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="data-[side=bottom]:translate-y-0 data-[side=left]:translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:translate-y-0 rounded-t-none max-w-sm min-w-0">
          <SelectGroup>
            {sortModes.map((mode) => (
              <SelectItem key={`Select-${mode}`} value={mode}>
                {mode}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        className="flex-1 rounded-none"
        variant={autoPlay ? "default" : "outline"}
        onClick={() => setAutoPlay(!autoPlay)}
      >
        Auto Play {autoPlay ? "ON" : "OFF"}
      </Button>
      <Select
        value={galleryViewMode}
        onValueChange={(selected) =>
          setGalleryViewMode(selected as GalleryViewMode)
        }
      >
        <SelectTrigger className="flex-1 w-full rounded-t-none sm:rounded sm:rounded-l-none">
          <SelectValue placeholder="Gallery View Mode" />
        </SelectTrigger>
        <SelectContent className="data-[side=bottom]:translate-y-0 data-[side=left]:translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:translate-y-0 rounded-t-none max-w-sm min-w-0">
          <SelectGroup>
            {galleryViewModes.map((mode) => (
              <SelectItem key={`Select-${mode}`} value={mode}>
                {mode}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
