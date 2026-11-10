import { rename } from "node:fs/promises";
import { CTypeDir } from "@tagapp/utils";
import { contentDataDB } from "../db/contentData.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { withSyncLock } from "../lib/syncLock.js";
import { SYNC } from "./getSyncData.js";
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
      try {
        for (const [from, to] of moves) {
          const move: [string, string] = [`${dir}/${from}`, `${dest}/${to}`];
          await rename(...move);
          moved.push(move);
        }

        contentDataDB.data = {
          [id]: isMedia ? data : { ...data, cover: ext[0] },
          ...contentDataDB.data,
        };
        IncrementTagCount(tags);
        recorded = true;
        await Promise.all([contentDataDB.write(), tagDB.write()]);

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
