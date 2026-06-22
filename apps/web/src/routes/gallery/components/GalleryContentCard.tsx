import { useCallback } from "react";
import { useDoc } from "../../contexts/Doc.Context";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  autoPlayAtom,
  currentModeAtom,
  type entry,
  selectedContentAtom,
} from "./atom";
import {
  contentModalDataAtom,
  contentModalOpenAtom,
} from "./GaleryContentModal";
import LazyVideo from "@/components/LazyVideo";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { cn } from "@/lib/utils";

const getMediaUrl = (encodedTitle: string, contentPath: string) =>
  `/media/Galleries/${encodedTitle}/${encodeURIComponent(contentPath)}`;

const ContentMold = ({
  data,
  currentMode,
}: {
  data: entry;
  currentMode: string;
}) => {
  const { encodedTitle } = useDoc();
  const autoPlay = useAtomValue(autoPlayAtom);

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
  const currentMode = useAtomValue(currentModeAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);

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
        else alert("Invalid cover selection (its a video file)");
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
      <button className="size-full" onClick={handleClick}>
        <ContentMold data={data} currentMode={currentMode} />
        <span className="text-base">{data.name}</span>
      </button>
    </div>
  );
}
