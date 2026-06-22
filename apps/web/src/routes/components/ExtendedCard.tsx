import { Button } from "@/components/ui/button";
import {
  Check,
  GalleryVerticalEnd,
  Headphones,
  Image,
  ScrollText,
  SquarePlay,
} from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { selectEntryAtom, selectionOnAtom } from "../atom.selection";
import {
  updateExtraDataAtom,
  updateIdAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { useAtomValue, useSetAtom } from "jotai";
import type { ContentServerType, CType } from "@tagapp/utils/types";
import { CTypeDir } from "@tagapp/utils";
import { useServerActions } from "../contexts/Server.Context";
import { cn } from "@/lib/utils";
import { TagParentChildList } from "./DocInfoSection";

function getCoverUrl(Content: ContentServerType) {
  const pathPrefix = `media/${CTypeDir[Content.type]}`;
  const encodedTitle = encodeURIComponent(`${Content.title}.${Content.id}`);
  const encodedCover = Content.cover ? encodeURIComponent(Content.cover) : null;
  switch (Content.type) {
    case "img":
    case "video":
      return `${pathPrefix}/.covers/cover.${encodedTitle}`;
    case "gallery":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/${encodedCover}`;
    case "audio":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/.audio-covers/${encodedCover}`;
    case "txt":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/.media/${encodedCover}`;
  }
}

const getUrl = (id: string, Type: string) => `/#/${Type}/${id}`;

const contentTypeIconsClassName =
  "absolute bg-background p-1.5 -top-5 right-2 rounded";
const contentTypeColor: Record<CType, ReturnType<typeof Image>> = {
  img: <Image size={"2rem"} className={contentTypeIconsClassName} />,
  video: <SquarePlay size={"2rem"} className={contentTypeIconsClassName} />,
  gallery: (
    <GalleryVerticalEnd size={"2rem"} className={contentTypeIconsClassName} />
  ),
  audio: <Headphones size={"2rem"} className={contentTypeIconsClassName} />,
  txt: <ScrollText size={"2rem"} className={contentTypeIconsClassName} />,
};

const ExtendedCard = memo(({ Content }: { Content: ContentServerType }) => {
  const { removeContents, isSelected } = useServerActions();

  const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
  const setUpdateId = useSetAtom(updateIdAtom);

  const setTitle = useSetAtom(updateTitleAtom);
  const setExtraData = useSetAtom(updateExtraDataAtom);
  const setUpdateTags = useSetAtom(updateTagsAtom);

  const selectionOn = useAtomValue(selectionOnAtom);
  const selectEntry = useSetAtom(selectEntryAtom);

  const updateSetupFunc = useCallback(() => {
    setTitle(Content.title);
    setUpdateTags(Content.tags.map((o: string) => ({ label: o, value: o })));
    setExtraData(Content.extraData);
    setUpdateId(Content.id);
    setUpdateModalOpen(true);
  }, [Content]);

  const removeContent = useCallback(() => {
    if (!confirm("Confirm Deletion")) return;
    removeContents([Content.id]);
  }, [Content.id]);

  const Selected = useMemo(
    () => isSelected(Content.id),
    [isSelected, Content.id],
  );

  const coverUrl = useMemo(() => getCoverUrl(Content), [Content]);

  return (
    <div
      onClick={() => selectionOn && selectEntry(Content.id)}
      className={cn(
        "block p-2 h-fit text-left relative",
        selectionOn && "border-2 rounded-sm cursor-pointer",
        selectionOn && Selected && "border-white opacity-80",
      )}
    >
      {coverUrl && (
        <>
          <div className="w-full bg-input/50 overflow-hidden rounded-sm">
            <img
              loading="lazy"
              className="object-contain m-auto max-h-[max(8.25rem,55vh)] w-full min-h-33"
              src={`/${coverUrl}`}
            />
          </div>
          <div className="relative h-5">{contentTypeColor[Content.type]}</div>
        </>
      )}
      <div className="w-[95%] ml-[2.5%] break-all">
        <div className="mb-3">
          <Button
            disabled={selectionOn}
            onClick={updateSetupFunc}
            className="w-1/2 rounded-r-none hover:bg-neutral-300/20 bg-neutral-300/10 dark:bg-neutral-800/30! dark:hover:bg-neutral-700/30!"
            variant="outline"
          >
            Edit
          </Button>
          <Button
            disabled={selectionOn}
            onClick={removeContent}
            className="w-1/2 rounded-l-none text-red-500 bg-red-600/10! dark:bg-red-950/20!"
            variant="outline"
          >
            Remove
          </Button>
        </div>
        <a href={getUrl(Content.id, Content.type)} target="_blank">
          <h1 className="mb-1 text-lg font-semibold font-stretch-condensed">
            {Content.title}
          </h1>
        </a>
        <div className="text-muted-foreground text-xs mb-4">
          {new Date(Content.added * 1000).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {!coverUrl && (
            <div className="relative text-foreground">
              {contentTypeColor[Content.type]}
            </div>
          )}
        </div>
        <div className="text-sm space-y-1">
          <div>
            ID: <span className="text-muted-foreground">{Content.id}</span>
          </div>
          <TagParentChildList tags={Content.tags} />
        </div>
      </div>
      {selectionOn ? (
        <>
          {Selected ? (
            <Check className="bg-foreground border-background border top-4 left-4 text-background absolute rounded-sm" />
          ) : (
            <div className="bg-background border-foreground border aspect-square h-5 top-4 left-4 text-background absolute rounded-sm" />
          )}
        </>
      ) : (
        <></>
      )}
    </div>
  );
});

export default ExtendedCard;
