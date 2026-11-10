import type { ContentServerType } from "@tagapp/utils/types";
import { memo, useState } from "react";
import ContentCard from "@/components/craft/library/ContentCard";

export type SyncItem = ContentServerType & {
  name: string;
  ext: (string | undefined)[];
};

// Caddy serves ./Sync at /media/.sync/ (apps/Caddyfile)
const syncUrl = (...parts: string[]) =>
  `/media/.sync/${parts.map(encodeURIComponent).join("/")}`;
const folderThumbDir = {
  gallery: [],
  txt: [".media"],
  audio: [".audio-covers"],
};

/** Cover (or the image itself, whose cover is only generated at sync), video and caption URLs of a pending item. */
function syncMedia({ name, type, ext: [cover, file, caption] }: SyncItem) {
  if (type === "img" || type === "video") {
    const media = syncUrl(`${name}.${file}`);
    return {
      cover: cover
        ? syncUrl(`cover.${name}.${cover}`)
        : type === "img"
          ? media
          : null,
      media,
      video:
        type === "video"
          ? { src: media, caption: caption && syncUrl(`caption.${name}.vtt`) }
          : undefined,
    };
  }
  // gallery thumbs already carry their subfolder (`.gallery-covers/...`)
  const thumb = cover?.split("/") ?? [];
  return {
    cover: cover
      ? syncUrl(`${name}.${type}`, ...folderThumbDir[type], ...thumb)
      : null,
  };
}

const SyncCard = memo(
  ({
    Content,
    onEdit,
    onRemove,
  }: {
    Content: SyncItem;
    onEdit?: (id: string) => void;
    onRemove?: (id: string) => void;
  }) => {
    const { cover, media, video } = syncMedia(Content);
    const [coverFailed, setCoverFailed] = useState(false);
    return (
      <ContentCard
        content={Content}
        url={media}
        cover={coverFailed ? null : cover}
        onCoverError={() => setCoverFailed(true)}
        video={video}
        onEdit={onEdit && (() => onEdit(Content.id))}
        onRemove={onRemove && (() => onRemove(Content.id))}
      />
    );
  },
);
SyncCard.displayName = "SyncCard";

export default SyncCard;
