import { useCallback, useMemo } from "react";
import { useDoc } from "../../contexts/Doc.Context";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  autoPlayFamily,
  currentModeAtom,
  type entry,
  selectedContentAtom,
  tagModalOpenAtom,
  tagModalDataAtom,
} from "./atom";
import {
  contentModalDataAtom,
  contentModalOpenAtom,
} from "./GalleryContentModal";
import LazyVideo from "@/components/LazyVideo";
import { Button } from "@/components/ui/button";
import { Trash, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function TagParentChildList({ tags }: { tags: string[] }) {
  const parentTags = useMemo(
    () => [...new Set([...tags.map((k) => k.split(":")[0])])],
    [tags],
  );

  return (
    <>
      {parentTags.sort().map((parent) => (
        <div key={parent}>
          {parent}:{" "}
          <span className="text-muted-foreground">
            {tags
              .filter((k) => k.startsWith(parent))
              .sort()
              .map((e) => e.replace(parent + ":", "").replaceAll("_", " "))
              .join(", ")}
          </span>
        </div>
      ))}
    </>
  );
}

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
    data.cover && getMediaUrl(encodedTitle, ".gallery-covers/" + data.cover);

  if (data.type === "video" && (autoPlay || !data.cover))
    return (
      <LazyVideo
        src={contentUrl}
        className="w-full min-h-36 mb-2 object-contain"
        AutoPlay={currentMode !== "cover" ? autoPlay : false}
      />
    );

  return (
    <img
      src={coverUrl || contentUrl}
      alt=""
      className="w-full min-h-36 mb-2 object-contain"
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
          updateCover(".gallery-covers/" + data.cover);
        else toast.warning("Invalid Option. Choose a valid cover image");
        break;
      default:
        break;
    }
  }, [data, doc, currentMode]);

  return (
    <div
      className={cn(
        "relative my-auto w-full hover:cursor-pointer",
        currentMode !== "view" && "border-2 p-3",
        currentMode === "delete" &&
          selected.includes(data.name) &&
          "border-red-500",
        currentMode === "cover" &&
          !(data.type === "img" || data.cover) &&
          "blur-[2px]",
      )}
    >
      {/* Remove Cover Action */}
      {!!tags && data.cover && currentMode === "view" && (
        <Button
          variant="destructive"
          className="absolute right-0 rounded-none rounded-bl z-10 backdrop-blur-xs"
          size="icon-lg"
          onClick={() => removeContentCover(data.cover!)}
        >
          <Trash />
        </Button>
      )}

      {/* Media Image / Video */}
      <button className="w-full text-left" onClick={handleClick}>
        <ContentMold data={data} currentMode={currentMode} />
      </button>

      {/* Inline Title & Edit Button */}
      <div className="flex items-center gap-2.5 mt-1">
        {currentMode === "view" && (
          <Button
            variant="secondary"
            size="icon-sm"
            className="rounded-none shrink-0"
            onClick={openTagModal}
          >
            <Tag className="size-4" />
          </Button>
        )}
        <button
          className="text-base truncate text-left w-full"
          onClick={handleClick}
        >
          {data.name}
        </button>
      </div>

      {/* Formatted Tag List (No pills/badges) */}
      {!!data.tags?.length && (
        <div className="mt-1.5 text-sm space-y-0.5">
          <TagParentChildList tags={data.tags} />
        </div>
      )}
    </div>
  );
}
