import GalleryContentCard from "./GalleryContentCard";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Slider } from "@/components/ui/slider";
import {
  galleryViewModeFamily,
  galleryListWidthFamily,
  currentModeAtom,
  galleryDataAtom,
  sortModeFamily,
} from "./atom";
import { useDoc } from "../../contexts/Doc.Context";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

export default function Gallery() {
  const { setCoverMutation, doc, setDoc, orpc } = useDoc();

  const galleryViewMode = useAtomValue(galleryViewModeFamily(doc.id));
  const sortMode = useAtomValue(sortModeFamily(doc.id)); // <-- Add sortMode
  const [galleryListWidth, setGalleryListWidth] = useAtom(
    galleryListWidthFamily(doc.id),
  );
  const [galleryData, setGalleryData] = useAtom(galleryDataAtom);
  const setCurrentMode = useSetAtom(currentModeAtom);

  // Compute sorted data reactively whenever galleryData or sortMode changes
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
    responsive: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
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
        {/* Map over sortedGalleryData instead of galleryData */}
        {sortedGalleryData.map((entry) => (
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
