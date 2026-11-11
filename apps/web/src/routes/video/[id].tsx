import { CAPTION_TAG } from "@tagapp/utils";
import { useMutation } from "@tanstack/react-query";
import { Image } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useCaptureFrame } from "@/hooks/useCaptureFrame";
import DocInfoSection from "../components/DocInfoSection";
import ItemHeader from "../components/ItemHeader";
import { useDoc } from "../contexts/Doc.Context";

export default function VideoPage() {
  const { orpc, doc, encodedTitle, tags } = useDoc();

  const videoUrl = `/media/Videos/${encodedTitle}`;
  const posterUrl = `/media/Videos/.covers/cover.${encodedTitle}`;
  const captionUrl =
    doc.tags.includes(CAPTION_TAG) &&
    `/media/Videos/.captions/caption.${encodedTitle}.vtt`;

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureFrame = useCaptureFrame(videoRef);
  const setCoverGivenFileMuation = useMutation(
    orpc.video.setCoverGivenFile.mutationOptions({
      onSuccess: () => {
        toast.success("Cover set successfully");
      },
    }),
  );

  const setCover = useCallback(async () => {
    if (
      !(await confirm({
        title: "Use this frame as the cover?",
        description:
          "The frame the video is paused on replaces this video's cover image.",
        confirmText: "Set cover",
      }))
    )
      return;
    const file = await captureFrame(`cover.${doc.title}.${doc.id}`);
    if (!file) return;
    setCoverGivenFileMuation.mutate({
      id: doc.id,
      name: doc.title,
      file,
    });
  }, [captureFrame, doc.id, doc.title, setCoverGivenFileMuation]);

  return (
    <>
      <ItemHeader
        Title="Video"
        description={
          tags
            ? "Pause on a frame, then use it as the cover."
            : "Play the video here."
        }
      />
      <div className="grid place-items-center gap-4 sm:flex sm:place-items-start">
        <div className="grid w-full gap-2 sm:w-3/5">
          <div className="min-h-64 w-full border bg-muted/40">
            <video
              ref={videoRef}
              className="mx-auto max-h-[60vh] min-h-64 w-full object-contain"
              src={videoUrl}
              poster={posterUrl}
              controls
            >
              {captionUrl ? (
                <track
                  src={captionUrl}
                  kind="subtitles"
                  srcLang="en"
                  label="English"
                />
              ) : null}
            </video>
          </div>
          {!!tags && (
            <Button
              onClick={setCover}
              size="sm"
              variant="outline"
              className="w-fit"
              title="Pause the video on a frame first, then use that frame as the cover"
            >
              <Image />
              Use current frame as cover
            </Button>
          )}
        </div>
        <DocInfoSection />
      </div>
    </>
  );
}
