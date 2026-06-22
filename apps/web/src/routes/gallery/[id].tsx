import TitleHeader from "@/components/craft/TitleHeader";
import { useDoc } from "../contexts/Doc.Context";
import DocInfoSection from "../components/DocInfoSection";
import { useMutation } from "@tanstack/react-query";
import GaleryContentModal from "./components/GaleryContentModal";
import { useSetAtom } from "jotai";

import GalleryOptions from "./components/GalleryOptions";
import Gallery from "./components/Gallery";
import { galleryDataAtom } from "./components/atom";
import FloatingButtons from "./components/FloatingButton";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useCallback, useEffect } from "react";

export default function GalleryPage() {
  const { doc, encodedTitle, setCoverMutation, tags, orpc } = useDoc();

  const setGalleryData = useSetAtom(galleryDataAtom);

  const getGalleryDataMutation = useMutation(
    orpc.gallery.getGalleryData.mutationOptions({
      onSuccess: (data) => {
        setGalleryData(data);
      },
    }),
  );

  const refreshGalleryDataMutation = useMutation(
    orpc.gallery.refreshGalleryData.mutationOptions({
      onSuccess: (data) => {
        setGalleryData(data);
      },
    }),
  );

  useEffect(() => {
    getGalleryDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc.title, doc.id]);

  const coverUrl = doc.cover
    ? `/media/Galleries/${encodedTitle}/${encodeURIComponent(doc.cover!)}`
    : null;

  const setCover = useCallback(
    (img?: string) => {
      if (!confirm("Confirm Cover Update")) return;
      setCoverMutation.mutate({ coverPath: img, id: doc.id, name: doc.title });
    },
    [doc.id],
  );

  return (
    <>
      <GaleryContentModal />
      <button
        className="w-fit grid mx-auto hover:cursor-pointer"
        onClick={() =>
          refreshGalleryDataMutation.mutate({ name: doc.title, id: doc.id })
        }
      >
        <TitleHeader Title="Gallery" />
      </button>
      <div className="grid place-items-center sm:place-items-start justify-center sm:flex gap-4 mb-6">
        {coverUrl && (
          <div className="relative w-full sm:w-2/5 rounded-sm bg-input/50 max-h-[max(30vh,25rem)] min-h-30 overflow-hidden">
            {!!tags && (
              <Button
                variant="destructive"
                className="absolute top-0 right-0 rounded-none rounded-bl backdrop-blur-xs"
                size="icon-lg"
                onClick={() => setCover()}
              >
                <Trash />
              </Button>
            )}
            <img
              className="w-full h-full max-h-[max(30vh,25rem)] object-contain"
              src={coverUrl}
              alt="Cover"
            />
          </div>
        )}
        <DocInfoSection />
      </div>
      {!!tags && <FloatingButtons />}
      <GalleryOptions />
      <Gallery />
    </>
  );
}
