import { useAtom, useAtomValue } from "jotai";
import { Play, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDoc } from "../contexts/Doc.Context";
import type { AudioEntry } from "./atom";
import { currentAtom, currentModeAtom, selectedContentAtom } from "./atom";

export default function AudioCard({
  data,
  updateCover,
  removeContentCover,
}: {
  data: AudioEntry;
  updateCover: (coverPath: string) => void;
  removeContentCover: (cover: string) => void;
}) {
  const { encodedTitle, tags } = useDoc();

  const currentMode = useAtomValue(currentModeAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [current, setCurrent] = useAtom(currentAtom);

  const handleClick = useCallback(() => {
    switch (currentMode) {
      case "view":
        setCurrent(data.name);
        break;
      case "delete":
        setSelected((prev) =>
          prev.includes(data.name)
            ? prev.filter((item) => item !== data.name)
            : [...prev, data.name],
        );
        break;
      case "cover":
        if (data.cover) updateCover(data.cover);
        break;
      default:
        break;
    }
  }, [data, currentMode, updateCover, setSelected, setCurrent]);

  const getAudioCover = (cover: string) =>
    `/media/Audios/${encodedTitle}/.audio-covers/${encodeURIComponent(cover)}`;

  const isCurrent = currentMode === "view" && current === data.name;
  const isSelected = selected.includes(data.name);

  return (
    <article
      className={cn(
        "relative flex flex-col border bg-card/40 transition-colors",
        currentMode === "view" && !isCurrent && "hover:border-foreground/30",
        isCurrent && "border-foreground ring-1 ring-foreground",
        currentMode === "delete" && isSelected && "border-destructive",
      )}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col text-left"
        onClick={handleClick}
        aria-label={
          currentMode === "view"
            ? `Play ${data.name}`
            : currentMode === "delete"
              ? `${isSelected ? "Unselect" : "Select"} ${data.name}`
              : `Use the cover of ${data.name} as this item's cover`
        }
      >
        {data.cover && (
          <img
            src={getAudioCover(data.cover)}
            alt=""
            loading="lazy"
            className="max-h-60 min-h-36 w-full border-b bg-muted/40 object-contain"
          />
        )}
        <span className="p-3 text-sm leading-snug font-medium [overflow-wrap:anywhere]">
          {data.name}
        </span>
      </button>
      {currentMode === "delete" && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleClick}
          aria-label={`Select ${data.name}`}
          className="absolute top-2 left-2 size-5 bg-background/90"
        />
      )}
      {(isCurrent || (!!tags && data.cover && currentMode === "view")) && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {isCurrent && (
              <>
                <Play className="size-3" aria-hidden />
                Selected track
              </>
            )}
          </span>
          {!!tags && data.cover && currentMode === "view" && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => data.cover && removeContentCover(data.cover)}
              title="Delete this track's cover image (the track itself is kept)"
              aria-label={`Delete cover image of ${data.name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
