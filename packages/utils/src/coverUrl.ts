import { CTypeDir } from "./constants";
import type { ContentServerType } from "./types";

/** Library cover URL of an item (relative to the site root), null when it has none. */
export function getCoverUrl(
  Content: Pick<ContentServerType, "type" | "title" | "id" | "cover">,
) {
  const pathPrefix = `media/${CTypeDir[Content.type]}`;
  const encodedTitle = encodeURIComponent(`${Content.title}.${Content.id}`);
  const encodedCover = Content.cover ? encodeURIComponent(Content.cover) : null;
  switch (Content.type) {
    case "img":
    case "video":
      return `${pathPrefix}/.covers/cover.${encodedTitle}`;
    case "gallery":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/${encodedCover}`;
    case "audio":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/.audio-covers/${encodedCover}`;
    case "txt":
      if (!encodedCover) return null;
      return `${pathPrefix}/${encodedTitle}/.media/${encodedCover}`;
  }
}
