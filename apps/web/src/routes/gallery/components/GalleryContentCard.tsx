import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Tag, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import TagChips from "@/components/craft/library/TagChips";
import LazyVideo from "@/components/LazyVideo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDoc } from "../../contexts/Doc.Context";
import {
  autoPlayFamily,
  currentModeAtom,
  type entry,
  selectedContentAtom,
  tagModalDataAtom,
  tagModalOpenAtom,
} from "./atom";
import {
  contentModalDataAtom,
  contentModalOpenAtom,
} from "./GalleryContentModal";

const getMediaUrl = (encodedTitle: string, contentPath: string) =>
  `/media/Galleries/${encodedTitle}/${encodeURIComponent(contentPath)}`;

const ContentMold = ({
  data,
  currentMode,
}: {
  data: entry;
  currentMode: string;
}) => {
  const {
    encodedTitle,
    doc: { id },
  } = useDoc();
  const autoPlay = useAtomValue(autoPlayFamily(id));

  const contentUrl = getMediaUrl(encodedTitle, data.name);
  const coverUrl =
    data.cover && getMediaUrl(encodedTitle, `.gallery-covers/${data.cover}`);

  if (data.type === "video" && (autoPlay || !data.cover))
    return (
      <LazyVideo
        src={contentUrl}
        className="max-h-80 min-h-36 w-full object-contain"
        AutoPlay={currentMode !== "cover" ? autoPlay : false}
      />
    );

  return (
    <img
      src={coverUrl || contentUrl}
      alt=""
      className="max-h-80 min-h-36 w-full object-contain"
      loading="lazy"
    />
  );
};

export default function GalleryContentCard({
  data,
  updateCover,
  removeContentCover,
}: {
  data: entry;
  updateCover: (coverPath: string) => void;
  removeContentCover: (cover: string) => void;
}) {
  const { doc, tags } = useDoc();

  const setContentModalOpen = useSetAtom(contentModalOpenAtom);
  const setContentModalData = useSetAtom(contentModalDataAtom);
  const setTagModalOpen = useSetAtom(tagModalOpenAtom);
  const setTagModalData = useSetAtom(tagModalDataAtom);

  const currentMode = useAtomValue(currentModeAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);

  const openTagModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTagModalData(data);
    setTagModalOpen(true);
  };

  const handleClick = useCallback(() => {
    switch (currentMode) {
      case "view":
        setContentModalData(data);
        setContentModalOpen(true);
        break;
      case "delete":
        setSelected((prev) =>
          prev.includes(data.name)
            ? prev.filter((item) => item !== data.name)
            : [...prev, data.name],
        );
        break;
      case "cover":
        if (data.type === "img") updateCover(data.name);
        else if (data.type === "video" && data.cover)
          updateCover(`.gallery-covers/${data.cover}`);
        else toast.warning("Invalid Option. Choose a valid cover image");
        break;
      default:
        break;
    }
  }, [data, doc, currentMode]);

  const isSelected = selected.includes(data.name);
  const notACoverChoice =
    currentMode === "cover" && !(data.type === "img" || data.cover);

  return (
    <article
      className={cn(
        "relative flex w-full flex-col border bg-card/40 transition-colors",
        currentMode === "view" && "hover:border-foreground/30",
        currentMode === "delete" && isSelected && "border-destructive",
        notACoverChoice && "opacity-50",
      )}
    >
      {/* Media image / video */}
      <button
        type="button"
        className="relative block w-full cursor-pointer border-b bg-muted/40 text-left"
        onClick={handleClick}
        aria-label={
          currentMode === "view"
            ? `Open ${data.name}`
            : currentMode === "delete"
              ? `${isSelected ? "Unselect" : "Select"} ${data.name}`
              : `Use ${data.name} as the cover`
        }
      >
        <ContentMold data={data} currentMode={currentMode} />
      </button>
      {currentMode === "delete" && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleClick}
          aria-label={`Select ${data.name}`}
          className="absolute top-2 left-2 size-5 bg-background/90"
        />
      )}

      <div className="grid gap-2 p-2">
        <button
          type="button"
          className="line-clamp-2 cursor-pointer text-left text-sm leading-snug font-medium [overflow-wrap:anywhere]"
          onClick={handleClick}
          title={data.name}
        >
          {data.name}
        </button>
        {!!data.tags?.length && <TagChips tags={data.tags} limit />}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t px-2 py-1">
        <time
          dateTime={new Date(data.createdAt * 1000).toISOString()}
          className="text-[11px] text-muted-foreground"
        >
          {new Date(data.createdAt * 1000).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </time>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={openTagModal}
            title="Rename this file and edit its tags"
            aria-label={`Edit name and tags of ${data.name}`}
          >
            <Tag />
            Edit
          </Button>
          {/* Remove Cover Action */}
          {!!tags && data.cover && currentMode === "view" && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => removeContentCover(data.cover!)}
              title="Delete this file's cover image (the file itself is kept)"
              aria-label={`Delete cover image of ${data.name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
