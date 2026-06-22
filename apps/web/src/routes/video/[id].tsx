import TitleHeader from "@/components/craft/TitleHeader";
import { useDoc } from "../contexts/Doc.Context";
import DocInfoSection from "../components/DocInfoSection";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useCallback } from "react";
import { useCaptureFrame } from "@/hooks/useCaptureFrame";

export default function VideoPage() {
  const { orpc, doc, encodedTitle, tags } = useDoc();

  const videoUrl = `/media/Videos/${encodedTitle}`;
  const posterUrl = `/media/Videos/.covers/cover.${encodedTitle}`;
  const captionUrl =
    doc.tags.includes("meta:cc") &&
    `/media/Videos/.captions/caption.${encodedTitle}.vtt`;

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureFrame = useCaptureFrame(videoRef);
  const setCoverGivenFileMuation = useMutation(
    orpc.video.setCoverGivenFile.mutationOptions({
      onSuccess: () => {
        alert("Cover set successfully");
      },
    }),
  );

  const setCover = useCallback(async () => {
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
      <TitleHeader Title="Video" />
      <div className="grid place-items-center sm:place-items-start sm:flex gap-4">
        <div className="w-full sm:w-3/5 rounded-sm max-h-[60vh] relative min-h-64 bg-input/50">
          <video
            ref={videoRef}
            className="object-contain max-h-[60vh] min-h-64 w-full mx-auto"
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
            ) : (
              <></>
            )}
          </video>
          {!!tags && (
            <Button
              onClick={setCover}
              size="icon-lg"
              variant="outline"
              className="rounded-none rounded-bl absolute top-0 right-0"
            >
              <Image />
            </Button>
          )}
        </div>
        <DocInfoSection />
      </div>
    </>
  );
}
