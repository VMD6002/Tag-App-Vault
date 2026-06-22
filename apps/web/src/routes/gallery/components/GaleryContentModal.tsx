import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDoc } from "../../contexts/Doc.Context";
import { type entry, galleryDataAtom } from "./atom";
import { useCaptureFrame } from "@/hooks/useCaptureFrame";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import { useCallback, useRef } from "react";

export const contentModalOpenAtom = atom(false);
export const contentModalDataAtom = atom<entry | null>(null);

export default function GaleryContentModal() {
  const data = useAtomValue(contentModalDataAtom);
  const [open, setOpen] = useAtom(contentModalOpenAtom);
  const { orpc, encodedTitle, doc, tags } = useDoc();
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
        alert(`${inputs.content} cover set successfully`);
      },
    }),
  );

  const setCover = useCallback(async () => {
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;
    setCoverGivenFileMuation.mutate({
      id: doc.id,
      name: doc.title,
      content: data?.name.split(".").slice(0, -1).join(".")!,
      file,
    });
  }, [captureFrame, doc.id, doc.title, setCoverGivenFileMuation, data?.name]);

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
              <Button
                onClick={setCover}
                size="icon-lg"
                className="rounded-none rounded-br absolute top-0 left-0"
              >
                <Image />
              </Button>
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
