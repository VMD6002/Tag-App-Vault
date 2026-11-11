import { rename } from "node:fs/promises";
import { CTypeDir, groupChildren, setInitialGroupCover } from "@tagapp/utils";
import type { GroupType } from "@tagapp/utils/types";
import { contentDataDB } from "../db/contentData.js";
import { groupsDB } from "../db/groups.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { withSyncLock } from "../lib/syncLock.js";
import { SYNC } from "./getSyncData.js";
import { addMissingGroups, dropGroups, stubsFor } from "./groups.js";
import { prepareSync } from "./prepareSync.js";

/** Syncs every ready item of `dir` (./Sync, or a download staging folder) into the library. */
export const syncContent = (dir = SYNC) =>
  withSyncLock(async () => {
    const syncData = await prepareSync(dir);

    for (const { ext, name, ...data } of Object.values(syncData)) {
      const { id, type, tags } = data;
      const isMedia = type === "img" || type === "video";
      const dest = `./media/${CTypeDir[type]}`;

      // [path inside dir, path inside the media dir]
      const moves: [string, string][] = isMedia
        ? [[`${name}.${ext[1]}`, `${name}.${ext[1]}`]]
        : [[`${name}.${type}`, name]];
      if (ext[0] && isMedia) {
        moves.push([
          `cover.${name}.${ext[0]}`,
          `.covers/cover.${name}.${ext[0]}`,
        ]);
      }
      if (ext[2]) {
        moves.push([`caption.${name}.vtt`, `.captions/caption.${name}.vtt`]);
      }

      const moved: [string, string][] = [];
      let recorded = false;
      let newGroups: ReturnType<typeof addMissingGroups> = [];
      // groups whose cover this item set, with the cover to put back on failure
      const covered: [GroupType, string | undefined][] = [];
      try {
        for (const [from, to] of moves) {
          const move: [string, string] = [`${dir}/${from}`, `${dest}/${to}`];
          await rename(...move);
          moved.push(move);
        }

        const item = isMedia ? data : { ...data, cover: ext[0] };
        // before the item is in: a group "had children" when one already pointed at it
        const empty = [...new Set(data.groups)].filter(
          (g) => !groupChildren(contentDataDB.data, g).length,
        );
        contentDataDB.data = { [id]: item, ...contentDataDB.data };
        IncrementTagCount(tags);
        // a group id the Vault doesn't know gets a record (title = id)
        newGroups = addMissingGroups(stubsFor(data.groups));
        for (const g of empty.flatMap((g) => groupsDB.data[g] ?? [])) {
          const before = g.cover;
          if (setInitialGroupCover(g, false, [item])) covered.push([g, before]);
        }
        recorded = true;
        await Promise.all([
          contentDataDB.write(),
          tagDB.write(),
          (newGroups.length || covered.length) && groupsDB.write(),
        ]);

        // The sidecar goes last: it is the only copy of the metadata until the DB is on disk.
        await Bun.file(`${dir}/${name}.json`)
          .delete()
          .catch((error) =>
            console.error(`Could not remove sidecar of ${id}:`, error),
          );
      } catch (error) {
        console.error(`Error processing content ${id}:`, error);

        if (recorded) {
          delete contentDataDB.data[id];
          DecrementTagCount(tags);
          dropGroups(newGroups);
          for (const [g, cover] of covered) g.cover = cover;
        }
        for (const [src, dst] of moved.reverse()) {
          await rename(dst, src).catch((rollbackError) =>
            console.error(
              `Failed to rollback ${dst} to ${src}:`,
              rollbackError,
            ),
          );
        }
      }
    }

    console.log("Data Synced");
    return contentDataDB.data;
  });
