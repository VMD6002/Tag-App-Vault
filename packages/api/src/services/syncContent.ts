import { rm, rename } from "node:fs/promises";
import { getSyncData } from "./getSyncData.js";
import { contentDataDB, contentDataDBType } from "../db/contentData.js";
import { IncrementTagCount, tagDB } from "../db/tags.js";
import { CTypeDir } from "@tagapp/utils";

export async function syncContent() {
  const Data = await getSyncData();
  const newContentData: contentDataDBType = {};

  for (const id in Data) {
    const content = Data[id]!;

    const { ext, ...data } = content;
    const coverFile = `cover.${content.title}.${content.id}.${content.ext[0]}`;
    const file = `${content.title}.${content.id}.${content.ext[1]}`;

    const movedFiles: { from: string; to: string }[] = [];

    const safeRename = async (from: string, to: string) => {
      await rename(from, to);
      movedFiles.push({ from, to });
    };

    try {
      newContentData[content.id] = data;

      switch (content.type) {
        case "img":
        case "video":
          await safeRename(
            `./Sync/${coverFile}`,
            `./media/${CTypeDir[content.type]}/.covers/${coverFile}`,
          );
          await safeRename(
            `./Sync/${file}`,
            `./media/${CTypeDir[content.type]}/${file}`,
          );
          if (content.tags.includes("meta:cc")) {
            const captionFile = `caption.${content.title}.${content.id}.vtt`;
            await safeRename(
              `./Sync/${captionFile}`,
              `./media/${CTypeDir[content.type]}/.captions/${captionFile}`,
            );
          }
          break;
        case "gallery":
        case "audio":
        case "txt":
          await safeRename(
            `./Sync/${content.title}.${content.id}.${content.type}`,
            `./media/${CTypeDir[content.type]}/${content.title}.${content.id}`,
          );
          newContentData[content.id]!.cover = content.ext[0];
          break;
        default:
          continue;
      }

      await rm(`./Sync/${content.title}.${content.id}.json`);

      IncrementTagCount(content.tags);
    } catch (error) {
      console.error(`Error processing content ${content.id}:`, error);

      for (const moved of movedFiles.reverse()) {
        try {
          await rename(moved.to, moved.from);
        } catch (rollbackError) {
          console.error(
            `Failed to rollback ${moved.to} to ${moved.from}:`,
            rollbackError,
          );
        }
      }

      delete newContentData[content.id];
      continue;
    }
  }

  contentDataDB.data = { ...newContentData, ...contentDataDB.data };

  await contentDataDB.write();
  await tagDB.write();
  console.log("Data Synced");
  return contentDataDB.data;
}
