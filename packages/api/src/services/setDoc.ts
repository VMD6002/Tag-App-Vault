import { CTypeDir, eqSet, SetDifferenceES6 } from "@tagapp/utils";
import { rename } from "node:fs/promises";
import { contentDataDB } from "../db/contentData.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { ORPCError } from "@orpc/server";
import type { DocType } from "../routers/main.js";
import { renameByBasename } from "../lib/fsBaseNameFunctions.js";

export async function setDoc(input: DocType) {
  const NewData = input;

  const OldData = contentDataDB.data[NewData.id];

  if (!OldData)
    throw new ORPCError("NOT_FOUND", {
      message: `Doc with id ${NewData.id} doesn't exist`,
    });

  // To change file Name when content Title is changed
  if (NewData.title !== OldData?.title) {
    switch (OldData.type) {
      case "img":
      case "video":
        const mvOperationData = [
          {
            baseDir: `./media/${CTypeDir[OldData.type]}`,
            oldPath: `${OldData.title}.${OldData.id}`,
            newPath: `${NewData.title}.${OldData.id}`,
          },
          {
            baseDir: `./media/${CTypeDir[OldData.type]}/.covers`,
            oldPath: `cover.${OldData.title}.${OldData.id}`,
            newPath: `cover.${NewData.title}.${OldData.id}`,
          },
        ];

        if (OldData.type === "video" && OldData.tags.includes("meta:cc"))
          mvOperationData.push({
            baseDir: `./media/${CTypeDir[OldData.type]}/.captions`,
            oldPath: `caption.${OldData.title}.${OldData.id}.vtt`,
            newPath: `caption.${NewData.title}.${OldData.id}.vtt`,
          });

        let completed = [];
        try {
          for (const operation of mvOperationData) {
            await renameByBasename(
              operation.baseDir,
              operation.oldPath,
              operation.newPath,
            );

            completed.push(operation); // Keep track of what we've done
          }
        } catch (error) {
          console.error("Renaming failed, rolling back changes...", error);

          // Rollback in reverse order
          for (const task of completed.reverse()) {
            try {
              await renameByBasename(task.baseDir, task.newPath, task.oldPath);
            } catch (rollbackError) {
              console.error(
                "Critical Failure: Could not rollback a change!",
                rollbackError,
              );
            }
          }
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message:
              "Failed to rename media files. System attempted to rollback changes.",
            cause: error,
          });
        }
        break;
      case "gallery":
      case "audio":
      case "txt":
        await rename(
          `./media/${CTypeDir[OldData.type]}/${OldData.title}.${OldData.id}`,
          `./media/${CTypeDir[OldData.type]}/${NewData.title}.${OldData.id}`,
        );
        break;
    }
  }
  const OldDataTags: Set<string> = new Set(OldData.tags);
  const NewDataTags: Set<string> = new Set(NewData.tags);
  if (!eqSet(OldDataTags, NewDataTags)) {
    // Deleted Tags
    const RemovedTags = SetDifferenceES6(OldDataTags, NewDataTags);
    DecrementTagCount(RemovedTags);
    // Newly Added Tags
    const AddedTags = SetDifferenceES6(NewDataTags, OldDataTags);
    IncrementTagCount(AddedTags);
  }

  const updatedData = {
    ...OldData,
    ...NewData,
  };
  contentDataDB.data[NewData.id] = updatedData;
  await contentDataDB.write();
  await tagDB.write();
  console.log(`Contents of ${NewData.id} Updated`);
  return updatedData;
}
