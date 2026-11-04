import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Tag, Trash } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import LazyVideo from "@/components/LazyVideo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TagParentChildList } from "../../components/DocInfoSection";
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
          updateCover(`.gallery-covers/${data.cover}`);
        else toast.warning("Invalid Option. Choose a valid cover image");
        break;
      default:
        break;
    }
  }, [data, doc, currentMode]);

  return (
    <div
      className={cn(
        "my-auto w-full hover:cursor-pointer",
        currentMode !== "view" && "border-2 p-3",
        currentMode === "delete" &&
          selected.includes(data.name) &&
          "border-red-500",
        currentMode === "cover" &&
          !(data.type === "img" || data.cover) &&
          "blur-[2px]",
      )}
    >
      {/* Media Image / Video */}
      <button className="w-full text-left" onClick={handleClick}>
        <ContentMold data={data} currentMode={currentMode} />
      </button>

      {/* Inline Title & Edit Button */}
      <div className="flex items-center gap-2.5 mt-1">
        <Button
          variant="secondary"
          size="icon-sm"
          className="rounded-none shrink-0"
          onClick={openTagModal}
        >
          <Tag className="size-4" />
        </Button>
        {/* Remove Cover Action */}
        {!!tags && data.cover && currentMode === "view" && (
          <Button
            variant="destructive"
            className="rounded-none shrink-0"
            size="icon-sm"
            onClick={() => removeContentCover(data.cover!)}
          >
            <Trash />
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
