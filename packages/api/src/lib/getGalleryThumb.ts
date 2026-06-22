import { readdir } from "node:fs/promises";
import getCtype from "./getCtype.js";

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
 *   3. Empty gallery / no usable thumbnail → returns `null`
 */
export async function getGalleryThumb(
  galleryPath: string,
): Promise<string | null> {
  const entries = await readdir(galleryPath);

  // Separate images from the rest, ignoring hidden dirs like `.cover`
  const images: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue; // skip .cover and other hidden entries
    const [ctype] = getCtype(entry);
    if (ctype === "img") images.push(entry);
  }

  // Case 2 & 3: Gallery has images (possibly mixed with videos) → use first image
  if (images.length > 0) {
    images.sort();
    return images[0]!;
  }

  // Case 1: Gallery has only videos (no images at root) → fall back to .gallery-covers/
  try {
    const coverEntries = (
      await readdir(`${galleryPath}/.gallery-covers`)
    ).sort();

    for (const entry of coverEntries) {
      const [ctype] = getCtype(entry);
      if (ctype === "img") return ".gallery-covers/" + entry;
    }
  } catch {
    // .gallery-covers directory doesn't exist — nothing we can do
  }

  // No usable thumbnail found
  return null;
}
