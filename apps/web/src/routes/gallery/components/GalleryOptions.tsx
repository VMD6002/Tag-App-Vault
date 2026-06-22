import { useAtom, useSetAtom } from "jotai";
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
  autoPlayAtom,
  galleryDataAtom,
  type SortMode,
  sortModeAtom,
  sortModes,
  galleryViewModeAtom,
} from "./atom";
import { useCallback } from "react";

const galleryViewModes = ["list", "grid-2", "grid-3", "grid-4"];

export default function GalleryOptions() {
  const [autoPlay, setAutoPlay] = useAtom(autoPlayAtom);

  const [sortMode, setSortMode] = useAtom(sortModeAtom);
  const [galleryViewMode, setGalleryViewMode] = useAtom(galleryViewModeAtom);

  const setGalleryData = useSetAtom(galleryDataAtom);

  const setSortModeHandler = useCallback((mode: SortMode) => {
    setSortMode(mode);
    setGalleryData((old) => {
      switch (mode) {
        case "created-date-asc":
          return [...old].sort((a, b) => a.createdAt - b.createdAt);
        case "created-date-desc":
          return [...old].sort((a, b) => b.createdAt - a.createdAt);
        case "updated-date-asc":
          return [...old].sort((a, b) => a.modifiedAt - b.modifiedAt);
        case "updated-date-desc":
          return [...old].sort((a, b) => b.modifiedAt - a.modifiedAt);
        case "name-asc":
          return [...old].sort((a, b) => a.name.localeCompare(b.name));
        case "name-desc":
          return [...old].sort((a, b) => b.name.localeCompare(a.name));
      }
    });
  }, []);

  return (
    <div className="w-full flex flex-col sm:flex-row mb-10">
      <Select
        value={sortMode}
        onValueChange={(selected) => setSortModeHandler(selected as SortMode)}
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
        onValueChange={(selected) => setGalleryViewMode(selected as "list")}
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
