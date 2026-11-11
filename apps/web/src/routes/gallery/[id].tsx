import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { Images, RefreshCw } from "lucide-react";
import { useCallback, useEffect } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import { Button } from "@/components/ui/button";
import CoverPanel, { confirmCover } from "../components/CoverPanel";
import DocInfoSection from "../components/DocInfoSection";
import ItemHeader from "../components/ItemHeader";
import { useDoc } from "../contexts/Doc.Context";
import { galleryDataAtom, selectedContentAtom } from "./components/atom";
import FloatingButtons from "./components/FloatingButton";
import Gallery from "./components/Gallery";
import GaleryContentModal from "./components/GalleryContentModal";
import GalleryOptions from "./components/GalleryOptions";
import { useGalleryFilter } from "./components/useGalleryFilter";

export default function GalleryPage() {
  const { doc, encodedTitle, setCoverMutation, tags, orpc } = useDoc();

  const setGalleryData = useSetAtom(galleryDataAtom);
  const galleryData = useAtomValue(galleryDataAtom);
  const filter = useGalleryFilter();
  const setSelected = useSetAtom(selectedContentAtom);

  // Never keep a selection the filter hides: delete would still act on it
  useEffect(() => {
    const visible = new Set(filter.filtered.map((e) => e.name));
    setSelected((old) =>
      old.every((n) => visible.has(n))
        ? old
        : old.filter((n) => visible.has(n)),
    );
  }, [filter.filtered, setSelected]);

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
  }, [doc.title, doc.id, getGalleryDataMutation.mutate]);

  const coverUrl = doc.cover
    ? `/media/Galleries/${encodedTitle}/${encodeURIComponent(doc.cover)}`
    : null;

  const setCover = useCallback(
    (img?: string) =>
      confirmCover(img).then((ok) => {
        if (ok)
          setCoverMutation.mutate({
            coverPath: img,
            id: doc.id,
            name: doc.title,
          });
      }),

    [doc.id, doc.title, setCoverMutation.mutate],
  );

  const loading =
    getGalleryDataMutation.isPending || getGalleryDataMutation.isIdle;
  const refresh = () =>
    refreshGalleryDataMutation.mutate({ name: doc.title, id: doc.id });

  return (
    <div className="relative">
      <GaleryContentModal />
      <ItemHeader
        Title="Gallery"
        description="Open a file to view it, or tag and rename it from its card."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={refreshGalleryDataMutation.isPending}
          onClick={refresh}
          title="Rescan this gallery's folder on the server for added or removed files"
        >
          <RefreshCw
            className={
              refreshGalleryDataMutation.isPending ? "animate-spin" : ""
            }
          />
          {refreshGalleryDataMutation.isPending
            ? "Refreshing…"
            : "Refresh files"}
        </Button>
      </ItemHeader>
      <div className="mb-6 grid place-items-center justify-center gap-4 sm:flex sm:place-items-start">
        {coverUrl && (
          <CoverPanel
            src={coverUrl}
            onRemove={tags ? () => setCover() : undefined}
          />
        )}
        <DocInfoSection />
      </div>
      {getGalleryDataMutation.isError ? (
        <ErrorState
          title="Couldn't load the gallery files"
          message={getGalleryDataMutation.error?.message}
          onRetry={() =>
            getGalleryDataMutation.mutate({ name: doc.title, id: doc.id })
          }
        />
      ) : loading && galleryData.length === 0 ? (
        <LoadingState label="Loading files…" />
      ) : galleryData.length === 0 ? (
        <EmptyState
          icon={Images}
          title="This gallery has no files"
          description="Add files to its folder on the server, then press Refresh files."
        />
      ) : (
        <>
          {!!tags && <FloatingButtons filter={filter} />}
          <GalleryOptions filter={filter} />
          <Gallery filter={filter} />
          <div className="h-16" />
        </>
      )}
    </div>
  );
}
