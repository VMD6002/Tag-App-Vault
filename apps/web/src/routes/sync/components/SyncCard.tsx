import type { ContentServerType, GroupsDB } from "@tagapp/utils/types";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { memo, useMemo, useState } from "react";
import ContentCard from "@/components/craft/library/ContentCard";
import {
  selectEntryAtom,
  selectionEntriesAtom,
  selectionOnAtom,
} from "@/routes/atom.selection";
import ItemGroupLinks from "@/routes/components/ItemGroupLinks";

export type SyncItem = ContentServerType & {
  name: string;
  ext: (string | undefined)[];
};

/** Selection key: a pending item is addressed by disk name and type (generated ids change on every scan). */
export const syncKey = ({ type, name }: SyncItem) => `${type}/${name}`;

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
    groups,
    onEdit,
    onRemove,
  }: {
    Content: SyncItem;
    /** `groups.list`; undefined while it loads (the Groups row waits for it). */
    groups?: GroupsDB;
    onEdit?: (id: string) => void;
    onRemove?: (id: string) => void;
  }) => {
    const { cover, media, video } = syncMedia(Content);
    const [coverFailed, setCoverFailed] = useState(false);
    const key = syncKey(Content);
    const selectionOn = useAtomValue(selectionOnAtom);
    // re-renders only when this card's own flag flips
    const selected = useAtomValue(
      useMemo(
        () => atom((get) => get(selectionEntriesAtom).includes(key)),
        [key],
      ),
    );
    const selectEntry = useSetAtom(selectEntryAtom);
    return (
      <ContentCard
        content={Content}
        url={media}
        cover={coverFailed ? null : cover}
        onCoverError={() => setCoverFailed(true)}
        video={video}
        selection={{
          on: selectionOn,
          selected,
          onToggle: () => selectEntry(key),
        }}
        extra={
          groups &&
          !!Content.groups?.length && (
            <ItemGroupLinks ids={Content.groups} groups={groups} />
          )
        }
        onEdit={onEdit && (() => onEdit(Content.id))}
        onRemove={onRemove && (() => onRemove(Content.id))}
      />
    );
  },
);
SyncCard.displayName = "SyncCard";

export default SyncCard;
