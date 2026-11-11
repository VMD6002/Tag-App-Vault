import { pickGroupCover } from "@tagapp/utils";
import type {
  ContentServerType,
  GroupCoverPickType,
  GroupType,
} from "@tagapp/utils/types";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { groupCoverPickAtom } from "@/atom";
import { getCoverUrl } from "@/lib/coverUrl";

/** Cover URL of a group card: its own cover, else a child's library cover chosen by `pick`. Null when there is none. */
export function groupCoverUrl(
  group: GroupType,
  children: ContentServerType[],
  pick: GroupCoverPickType,
) {
  const cover = pickGroupCover(
    group,
    // The children's cover is a file name; their URL is built like the library card's
    children.map((c) => ({
      added: c.added,
      cover: getCoverUrl(c) ?? undefined,
    })),
    pick,
  );
  // Library covers come without the leading slash; a group's own cover may be any URL
  return cover ? (cover.startsWith("media/") ? `/${cover}` : cover) : null;
}

/** `groupCoverUrl` with the device-local cover pick (Settings page). */
export function useGroupCover() {
  const pick = useAtomValue(groupCoverPickAtom);
  return useCallback(
    (group: GroupType, children: ContentServerType[]) =>
      groupCoverUrl(group, children, pick),
    [pick],
  );
}
