import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDoc } from "../../contexts/Doc.Context";
import { type entry, galleryDataAtom } from "./atom";
import { useCaptureFrame } from "@/hooks/useCaptureFrame";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Image, ImagePlus } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

export const contentModalOpenAtom = atom(false);
export const contentModalDataAtom = atom<entry | null>(null);

export default function GaleryContentModal() {
  const data = useAtomValue(contentModalDataAtom);
  const [open, setOpen] = useAtom(contentModalOpenAtom);
  const { orpc, encodedTitle, doc, tags, setCoverMutation, setDoc } = useDoc();
  const setGalleryData = useSetAtom(galleryDataAtom);

  const contentUrl = `/media/Galleries/${encodedTitle}/${encodeURIComponent(data?.name!)}`;
  const coverUrl =
    data?.type === "video" && data?.cover
      ? `/media/Galleries/${encodedTitle}/.gallery-covers/${encodeURIComponent(data?.cover!)}`
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
    if (!confirm("U sure u want to set new cover ??")) return;
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;
    setCoverGivenFileMuation.mutate({
      id: doc.id,
      name: doc.title,
      content: data?.name.split(".").slice(0, -1).join(".")!,
      file,
    });
  }, [captureFrame, doc.id, doc.title, setCoverGivenFileMuation, data?.name]);

  const setVideoAndGalleryCover = useCallback(async () => {
    if (!confirm("Set current frame as video cover AND gallery cover?")) return;
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;

    const contentName = data?.name.split(".").slice(0, -1).join(".")!;

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
      toast.success("Failed to set video and gallery cover");
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
      <DialogContent className="max-w-[80vw] sm:max-w-[80vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] border-0 bg-secondary/60 backdrop-blur p-0">
        {data?.type === "video" ? (
          <div className="w-full max-h-[90vh] relative min-h-64 bg-input/50">
            <video
              className="max-h-[90vh] size-full object-contain"
              poster={coverUrl}
              src={contentUrl}
              controls
              ref={videoRef}
            />
            {!!tags && (
              <div className="absolute top-0 left-0 flex rounded-br overflow-hidden z-10">
                <Button
                  onClick={setCover}
                  size="icon-lg"
                  className="rounded-none"
                  title="Set Video Cover"
                >
                  <Image />
                </Button>
                <Button
                  onClick={setVideoAndGalleryCover}
                  size="icon-lg"
                  variant="secondary" // <-- Change to "secondary", "default", or use custom Tailwind like "bg-primary text-primary-foreground"
                  className="rounded-none"
                  title="Set Video & Gallery Cover"
                >
                  <ImagePlus />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <img
            className="max-h-[90vh] size-full object-contain"
            src={contentUrl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
