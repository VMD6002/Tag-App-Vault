import { rename, rm } from "node:fs/promises";
import { CTypeDir } from "@tagapp/utils";
import { contentDataDB, type contentDataDBType } from "../db/contentData.js";
import { IncrementTagCount, tagDB } from "../db/tags.js";
import { withSyncLock } from "../lib/syncLock.js";
import { prepareSync } from "./prepareSync.js";

export const syncContent = () =>
  withSyncLock(async () => {
    const syncData = await prepareSync();
    const synced: contentDataDBType = {};

    for (const { ext, name, ...data } of Object.values(syncData)) {
      const { id, type, tags } = data;
      const isMedia = type === "img" || type === "video";
      const dest = `./media/${CTypeDir[type]}`;

      // [path inside ./Sync, path inside the media dir]
      const moves: [string, string][] = isMedia
        ? [
            [`cover.${name}.${ext[0]}`, `.covers/cover.${name}.${ext[0]}`],
            [`${name}.${ext[1]}`, `${name}.${ext[1]}`],
          ]
        : [[`${name}.${type}`, name]];
      if (ext[2]) {
        moves.push([`caption.${name}.vtt`, `.captions/caption.${name}.vtt`]);
      }

      const moved: [string, string][] = [];
      try {
        for (const [from, to] of moves) {
          const move: [string, string] = [`./Sync/${from}`, `${dest}/${to}`];
          await rename(...move);
          moved.push(move);
        }
        await rm(`./Sync/${name}.json`);

        IncrementTagCount(tags);
        synced[id] = isMedia ? data : { ...data, cover: ext[0] };
      } catch (error) {
        console.error(`Error processing content ${id}:`, error);

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

    if (Object.keys(synced).length) {
      contentDataDB.data = { ...synced, ...contentDataDB.data };
      await Promise.all([contentDataDB.write(), tagDB.write()]);
    }

    console.log("Data Synced");
    return contentDataDB.data;
  });
