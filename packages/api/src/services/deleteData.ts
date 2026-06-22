import { rm, rename } from "node:fs/promises";
import { contentDataDB } from "../db/contentData.js";
import { DecrementTagCount, tagDB } from "../db/tags.js";
import { ORPCError } from "@orpc/server";
import { rmByBasename, renameByBasename } from "../lib/fsBaseNameFunctions.js";
import { ContentServerType } from "@tagapp/utils/types";
import { CTypeDir } from "@tagapp/utils";

export async function deleteData(IdList: string[]) {
  const Deleted: ContentServerType[] = [];

  for (const ID of IdList) {
    if (!contentDataDB.data[ID]) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Content with id ${ID} doesn't exist`,
      });
    }
    Deleted.push(contentDataDB.data[ID]);
  }

  const successfullyDeletedIds: string[] = [];

  for (const ContentDeleted of Deleted) {
    const movedFiles: {
      isBasename: boolean;
      dir?: string;
      from?: string;
      to?: string;
      exactFrom?: string;
      exactTo?: string;
    }[] = [];

    const safeRenameBasename = async (
      dir: string,
      from: string,
      to: string,
    ) => {
      await renameByBasename(dir, from, to);
      movedFiles.push({ isBasename: true, dir, from, to });
    };

    const safeRenameExact = async (from: string, to: string) => {
      await rename(from, to);
      movedFiles.push({ isBasename: false, exactFrom: from, exactTo: to });
    };

    try {
      switch (ContentDeleted.type) {
        case "img":
        case "video":
          await safeRenameBasename(
            `./media/${CTypeDir[ContentDeleted.type]}/.covers`,
            `cover.${ContentDeleted.title}.${ContentDeleted.id}`,
            `cover.${ContentDeleted.title}.${ContentDeleted.id}.del`,
          );
          await safeRenameBasename(
            `./media/${CTypeDir[ContentDeleted.type]}`,
            `${ContentDeleted.title}.${ContentDeleted.id}`,
            `${ContentDeleted.title}.${ContentDeleted.id}.del`,
          );
          if (ContentDeleted.tags.includes("meta:caption"))
            await safeRenameExact(
              `./media/${CTypeDir[ContentDeleted.type]}/.captions/caption.${ContentDeleted.title}.${ContentDeleted.id}.vtt`,
              `./media/${CTypeDir[ContentDeleted.type]}/.captions/caption.${ContentDeleted.title}.${ContentDeleted.id}.vtt.del`,
            );
          break;
        case "gallery":
        case "audio":
        case "txt":
          await safeRenameExact(
            `./media/${CTypeDir[ContentDeleted.type]}/${ContentDeleted.title}.${ContentDeleted.id}`,
            `./media/${CTypeDir[ContentDeleted.type]}/${ContentDeleted.title}.${ContentDeleted.id}.del`,
          );
          break;
        default:
          continue;
      }

      for (const moved of movedFiles) {
        if (moved.isBasename) await rmByBasename(moved.dir!, moved.to!);
        else await rm(moved.exactTo!, { recursive: true, force: true });
      }

      DecrementTagCount(ContentDeleted.tags);
      delete contentDataDB.data[ContentDeleted.id];
      successfullyDeletedIds.push(ContentDeleted.id);

      console.log(
        `Removed ${ContentDeleted.title} from ${ContentDeleted.type}`,
      );
    } catch (error) {
      console.error(`Error deleting content ${ContentDeleted.id}:`, error);

      for (const moved of movedFiles.reverse()) {
        try {
          if (moved.isBasename)
            await renameByBasename(moved.dir!, moved.to!, moved.from!);
          else await rename(moved.exactTo!, moved.exactFrom!);
        } catch (rollbackError) {
          console.error(
            `Failed to rollback deletion for ${moved.to || moved.exactTo}:`,
            rollbackError,
          );
        }
      }

      continue;
    }
  }

  await contentDataDB.write();
  await tagDB.write();

  console.log("Changes Written TO DB");

  return successfullyDeletedIds;
}
