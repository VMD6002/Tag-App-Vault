import { useMutation } from "@tanstack/react-query";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Image, ImagePlus } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCaptureFrame } from "@/hooks/useCaptureFrame";
import { useDoc } from "../../contexts/Doc.Context";
import { type entry, galleryDataAtom } from "./atom";

export const contentModalOpenAtom = atom(false);
export const contentModalDataAtom = atom<entry | null>(null);

export default function GaleryContentModal() {
  const data = useAtomValue(contentModalDataAtom);
  const [open, setOpen] = useAtom(contentModalOpenAtom);
  const { orpc, encodedTitle, doc, tags, setCoverMutation, setDoc } = useDoc();
  const setGalleryData = useSetAtom(galleryDataAtom);

  const contentUrl = data?.name
    ? `/media/Galleries/${encodedTitle}/${encodeURIComponent(data.name)}`
    : "";
  const coverUrl =
    data?.type === "video" && data?.cover
      ? `/media/Galleries/${encodedTitle}/.gallery-covers/${encodeURIComponent(data.cover)}`
      : undefined;

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureFrame = useCaptureFrame(videoRef);
  const setCoverGivenFileMuation = useMutation(
    orpc.gallery.setCoverGivenFile.mutationOptions({
      onSuccess: (data, inputs) => {
        setGalleryData(data);
        toast.success(`${inputs.content} cover set successfully`);
      },
    }),
  );

  const setCover = useCallback(async () => {
    if (
      !(await confirm({
        title: "Use this frame as the video's cover?",
        description:
          "The frame the video is paused on becomes this video's cover image in the gallery.",
        confirmText: "Set cover",
      }))
    )
      return;
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;
    setCoverGivenFileMuation.mutate({
      id: doc.id,
      name: doc.title,
      content: data?.name ? data.name.split(".").slice(0, -1).join(".") : "",
      file,
    });
  }, [captureFrame, doc.id, doc.title, setCoverGivenFileMuation, data?.name]);

  const setVideoAndGalleryCover = useCallback(async () => {
    if (
      !(await confirm({
        title: "Use this frame for the video and the gallery?",
        description:
          "The frame the video is paused on becomes this video's cover image and also the cover of the whole gallery.",
        confirmText: "Set both covers",
      }))
    )
      return;
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;

    const contentName = data?.name
      ? data.name.split(".").slice(0, -1).join(".")
      : "";

    try {
      const updatedGalleryData = await setCoverGivenFileMuation.mutateAsync({
        id: doc.id,
        name: doc.title,
        content: contentName,
        file,
      });
      setGalleryData(updatedGalleryData);

      const updatedItem = updatedGalleryData.find(
        (item) => item.name === data?.name,
      );
      const coverFilename =
        updatedItem?.cover ?? `cover.${contentName}.${file.type.split("/")[1]}`;
      const coverPath = `.gallery-covers/${coverFilename}`;

      const res = await setCoverMutation.mutateAsync({
        id: doc.id,
        name: doc.title,
        coverPath,
      });
      setDoc((old) => ({ ...old, cover: res.coverPath }));
      toast.success("Video cover and gallery cover set successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to set video and gallery cover");
    }
  }, [
    captureFrame,
    data?.name,
    doc.id,
    doc.title,
    setCoverGivenFileMuation,
    setGalleryData,
    setCoverMutation,
    setDoc,
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[80vw] border-0 bg-secondary/60 p-0 backdrop-blur sm:max-w-[80vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw]">
        <DialogTitle className="sr-only">
          {data?.name ?? "Gallery content"}
        </DialogTitle>
        {data?.type === "video" ? (
          <div className="grid">
            <div className="max-h-[80vh] min-h-64 w-full bg-input/50">
              <video
                className="size-full max-h-[80vh] object-contain"
                poster={coverUrl}
                src={contentUrl}
                controls
                ref={videoRef}
              />
            </div>
            {!!tags && (
              <div className="flex flex-wrap items-center gap-2 bg-popover/90 p-2">
                <Button
                  onClick={setCover}
                  size="sm"
                  variant="outline"
                  title="Pause the video on a frame first, then use that frame as this video's cover"
                >
                  <Image />
                  Use frame as video cover
                </Button>
                <Button
                  onClick={setVideoAndGalleryCover}
                  size="sm"
                  variant="outline"
                  title="Pause the video on a frame first, then use it as this video's cover and the gallery's cover"
                >
                  <ImagePlus />
                  Use frame as video and gallery cover
                </Button>
              </div>
            )}
          </div>
        ) : (
          <img
            className="max-h-[90vh] size-full object-contain"
            src={contentUrl}
            alt={data?.name ?? "Gallery content"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
