import { useCallback } from "react";
import { type RefObject } from "react";

export const useCaptureFrame = (
  videoRef: RefObject<HTMLVideoElement | null>,
) => {
  const captureFrame = useCallback(
    (title: string): Promise<File | null> => {
      const video = videoRef.current;

      if (
        !video ||
        video.readyState < 2 ||
        video.seeking ||
        !video.paused ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return Promise.resolve(null);
      }

      // 1. Quick check for blankness using a tiny canvas (low cost)
      const checkCanvas = document.createElement("canvas");
      checkCanvas.width = 10;
      checkCanvas.height = 10;
      const checkCtx = checkCanvas.getContext("2d");
      if (!checkCtx) return Promise.resolve(null);

      checkCtx.drawImage(video, 0, 0, 10, 10);
      const checkData = checkCtx.getImageData(0, 0, 10, 10).data;

      let isBlank = true;
      for (let i = 0; i < checkData.length; i += 4) {
        if (
          checkData[i] !== 0 ||
          checkData[i + 1] !== 0 ||
          checkData[i + 2] !== 0
        ) {
          isBlank = false;
          break;
        }
      }

      if (isBlank) {
        alert(
          "Captured frame is blank (pure black/transparent). Choose another Frame",
        );
        return Promise.resolve(null);
      }

      // 2. Full-resolution capture only if not blank
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Canvas context not found.");
        return Promise.resolve(null);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 3. Convert canvas to a Blob (WebP at 80% quality)
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }

            // 4. Wrap the blob in a File object
            const file = new File([blob], `${title}.webp`, {
              type: "image/webp",
            });

            resolve(file);
          },
          "image/webp",
          0.8, // Quality setting
        );
      });
    },
    [videoRef],
  );

  return captureFrame;
};
