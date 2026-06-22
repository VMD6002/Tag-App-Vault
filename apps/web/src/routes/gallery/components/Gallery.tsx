import GalleryContentCard from "./GalleryContentCard";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Slider } from "@/components/ui/slider";
import {
  galleryViewModeAtom,
  galleryListWidthAtom,
  currentModeAtom,
  galleryDataAtom,
} from "./atom";
import { useDoc } from "../../contexts/Doc.Context";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

export default function Gallery() {
  const { setCoverMutation, doc, setDoc, orpc } = useDoc();

  const galleryViewMode = useAtomValue(galleryViewModeAtom);
  const [galleryListWidth, setGalleryListWidth] = useAtom(galleryListWidthAtom);
  const galleryData = useAtomValue(galleryDataAtom);
  const setCurrentMode = useSetAtom(currentModeAtom);
  const setGalleryData = useSetAtom(galleryDataAtom);

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
          alert("Failed to update Cover");
        });
    },
    [doc],
  );

  const removeContentMutation = useMutation(
    orpc.gallery.removeGalleryContents.mutationOptions({
      onSuccess: (res) => {
        setGalleryData(res);
      },
    }),
  );

  const removeContentCover = useCallback(
    (cover: string) => {
      if (!confirm(`Confirm ${cover} removal`)) return;
      removeContentMutation.mutate({
        name: doc.title,
        id: doc.id,
        contents: [".gallery-covers/" + cover],
      });
    },
    [doc],
  );

  const isList = galleryViewMode === "list";

  const layoutClasses = {
    list: "mx-auto",
    "grid-2": "grid-cols-2",
    "grid-3": "grid-cols-3",
    "grid-4": "grid-cols-4",
  };

  return (
    <>
      {isList && (
        <div className="h-10 sticky top-19 grid bg-background z-10">
          <Slider
            className="w-[calc(100%-2rem)] m-auto"
            value={[Number(galleryListWidth)]}
            onValueChange={(o) => setGalleryListWidth(o[0])}
            max={100}
            step={1}
          />
        </div>
      )}
      <div
        className={`grid gap-4 ${layoutClasses[galleryViewMode]}`}
        style={isList ? { width: galleryListWidth + "%" } : {}}
      >
        {galleryData.map((entry) => (
          <GalleryContentCard
            removeContentCover={removeContentCover}
            updateCover={updateCover}
            key={entry.name}
            data={entry}
          />
        ))}
      </div>
    </>
  );
}
