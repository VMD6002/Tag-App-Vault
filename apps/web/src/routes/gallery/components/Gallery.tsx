import { useMutation } from "@tanstack/react-query";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useDoc } from "../../contexts/Doc.Context";
import {
  autoPlayFamily,
  currentModeAtom,
  galleryDataAtom,
  galleryListWidthFamily,
  galleryViewModeFamily,
  sortModeFamily,
} from "./atom";
import GalleryContentCard from "./GalleryContentCard";
import TagContentModal from "./TagContentModal";

export default function Gallery() {
  const { setCoverMutation, doc, setDoc, orpc } = useDoc();

  const galleryViewMode = useAtomValue(galleryViewModeFamily(doc.id));
  const sortMode = useAtomValue(sortModeFamily(doc.id));
  const [galleryListWidth, setGalleryListWidth] = useAtom(
    galleryListWidthFamily(doc.id),
  );
  const [galleryData, setGalleryData] = useAtom(galleryDataAtom);
  const setCurrentMode = useSetAtom(currentModeAtom);
  const setAutoPlay = useSetAtom(autoPlayFamily(doc.id));

  const sortedGalleryData = useMemo(() => {
    return [...galleryData].sort((a, b) => {
      switch (sortMode) {
        case "created-date-asc":
          return a.createdAt - b.createdAt;
        case "created-date-desc":
          return b.createdAt - a.createdAt;
        case "updated-date-asc":
          return a.modifiedAt - b.modifiedAt;
        case "updated-date-desc":
          return b.modifiedAt - a.modifiedAt;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
  }, [galleryData, sortMode]);

  const updateCover = useCallback(
    (coverPath: string) => {
      setCoverMutation
        .mutateAsync({ name: doc.title, id: doc.id, coverPath })
        .then((res) => {
          setDoc((old) => ({ ...old, cover: res.coverPath }));
          setCurrentMode("view");
        })
        .catch((err) => {
          console.log(err);
          toast.error("Failed to update Cover");
        });
    },
    [doc, setCurrentMode, setDoc, setCoverMutation.mutateAsync],
  );

  const removeContentMutation = useMutation(
    orpc.gallery.removeGalleryContents.mutationOptions({
      onSuccess: (res) => {
        setGalleryData(res);
      },
    }),
  );

  const removeContentCover = useCallback(
    (cover: string) =>
      confirm
        .destructive({
          title: "Delete this cover image?",
          description: `${cover} will be deleted from the server. The file it belongs to is kept.`,
          confirmText: "Delete cover",
        })
        .then((ok) => {
          if (ok)
            removeContentMutation.mutate({
              name: doc.title,
              id: doc.id,
              contents: [`.gallery-covers/${cover}`],
            });
        }),
    [doc, removeContentMutation.mutate],
  );

  const isList = galleryViewMode === "list";

  const layoutClasses = {
    list: "flex flex-col mx-auto gap-6",
    responsive:
      "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3",
    "grid-2": "grid grid-cols-2 gap-4",
    "grid-3": "grid grid-cols-3 gap-4",
    "grid-4": "grid grid-cols-4 gap-3",
  };

  useEffect(() => {
    if (doc.tags.includes("meta:autoplay")) setAutoPlay(true);
  }, [doc.tags, setAutoPlay]);

  return (
    <>
      {isList && (
        <div className="sticky top-[6.75rem] z-10 mb-4 flex items-center gap-3 border-b bg-background/95 py-2">
          <Label
            id="gallery-width-label"
            className="shrink-0 text-xs text-muted-foreground"
          >
            Column width
          </Label>
          <Slider
            aria-labelledby="gallery-width-label"
            className="flex-1"
            value={[Number(galleryListWidth)]}
            onValueChange={(o) => setGalleryListWidth([o].flat()[0])}
            max={100}
            step={1}
          />
        </div>
      )}
      <div
        className={layoutClasses[galleryViewMode]}
        style={isList ? { width: `${galleryListWidth}%` } : {}}
      >
        {sortedGalleryData.map((entry) => (
          <GalleryContentCard
            removeContentCover={removeContentCover}
            updateCover={updateCover}
            key={entry.name}
            data={entry}
          />
        ))}
      </div>

      <TagContentModal />
    </>
  );
}
