import { readdir } from "node:fs/promises";
import getCtype from "./getCtype.js";

/** First image in `dir` in natural order (`img2` before `img10`), ignoring hidden entries. */
export async function firstImage(dir: string) {
  const entries = await readdir(dir).catch(() => []);
  return entries
    .filter((e) => !e.startsWith(".") && getCtype(e)[0] === "img")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
}

/**
 * Gets a cover/thumbnail image for a gallery folder.
 *
 * Gallery structure:
 *   MyGallery.gallery/
 *     .gallery-covers/        — cover images for the videos in the gallery
 *     image1.jpg     — gallery files (images and videos)
 *     video1.mp4
 *
 * Resolution strategy:
 *   1. Gallery with images (with or without videos) → first image from the gallery root
 *   2. Gallery with only videos → first image from the `.gallery-covers` subfolder
 *   3. Empty gallery / no usable thumbnail → returns `undefined`
 */
export async function getGalleryThumb(galleryPath: string) {
  const root = await firstImage(galleryPath);
  if (root) return root;
  const cover = await firstImage(`${galleryPath}/.gallery-covers`);
  return cover && `.gallery-covers/${cover}`;
}
