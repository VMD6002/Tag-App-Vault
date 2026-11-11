import type { GroupedInLibraryType, GroupSortType } from "@tagapp/utils/types";
import { useAtom } from "jotai";
import { Link } from "wouter";
import { groupedInLibraryAtom, groupSortAtom } from "@/atom";
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

const groupSortLabels: Record<GroupSortType, string> = {
  newestChild: "Newest item added",
  created: "Group created",
  updated: "Group last updated",
};

const groupedInLibraryLabels: Record<GroupedInLibraryType, string> = {
  hide: "Hidden unless tagged view:in-library",
  show: "Shown unless tagged view:hide-in-library",
};

export default function SettingsPage() {
  const [groupedInLibrary, setGroupedInLibrary] = useAtom(groupedInLibraryAtom);
  const [groupSort, setGroupSort] = useAtom(groupSortAtom);
  const [sortMode, setSortMode] = useAtom(defaultSortModeAtom);
  const [viewMode, setViewMode] = useAtom(defaultViewModeAtom);
  const [autoPlay, setAutoPlay] = useAtom(defaultAutoPlayAtom);
  const [listWidth, setListWidth] = useAtom(defaultListWidthAtom);

  return (
    <>
      <TitleHeader
        Title="Settings"
        description={
          <>
            Gallery and group display options, kept in this browser only. A
            gallery with a <code>view:</code> tag follows that tag, and one you
            changed yourself keeps its own choice until you reset it there.{" "}
            <Link href="/reference" className="underline underline-offset-4">
              Tag shortcuts
            </Link>
          </>
        }
      />
      <h2 className="mb-3 text-sm font-semibold">Galleries</h2>
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
      <h2 className="mb-3 text-sm font-semibold">Groups</h2>
      <section className="mb-10 grid max-w-md gap-5">
        <div className="grid gap-1.5">
          <Label>Group position in the library</Label>
          <Select
            value={groupSort}
            items={groupSortLabels}
            onValueChange={(v) => v && setGroupSort(v as GroupSortType)}
          >
            <SelectTrigger className="w-56" aria-label="Group position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {(Object.keys(groupSortLabels) as GroupSortType[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {groupSortLabels[m]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Where group cards sit among the items. Applies the next time the
            library is filtered.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label>Grouped items in the library</Label>
          <Select
            value={groupedInLibrary}
            items={groupedInLibraryLabels}
            onValueChange={(v) =>
              v && setGroupedInLibrary(v as GroupedInLibraryType)
            }
          >
            <SelectTrigger
              className="w-72"
              aria-label="Grouped items in the library"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-auto min-w-(--anchor-width)"
            >
              <SelectGroup>
                {(
                  Object.keys(groupedInLibraryLabels) as GroupedInLibraryType[]
                ).map((m) => (
                  <SelectItem key={m} value={m}>
                    {groupedInLibraryLabels[m]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Whether items that belong to a group also appear in the main
            library. "Show grouped items" in the advanced search and the "Also
            show in the main library" switch only matter when they are hidden.
            Applies the next time the library is filtered.
          </p>
        </div>
      </section>
    </>
  );
}
