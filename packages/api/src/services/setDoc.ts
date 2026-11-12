import { rename } from "node:fs/promises";
import { ORPCError } from "@orpc/server";
import {
  addGroupItems,
  CAPTION_TAG,
  CTypeDir,
  eqSet,
  removeGroupItems,
  SetDifferenceES6,
} from "@tagapp/utils";
import { contentDataDB } from "../db/contentData.js";
import { groupsDB } from "../db/groups.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { hasBasename, renameByBasename } from "../lib/fsBaseNameFunctions.js";
import type { DocType } from "../routers/main.js";

export async function setDoc(input: DocType) {
  // `groups` (optional) is the item's complete group list: `[]` clears it, absent leaves it alone
  const { groups: wantedGroups, ...NewData } = input;

  const OldData = contentDataDB.data[NewData.id];

  if (!OldData)
    throw new ORPCError("NOT_FOUND", {
      message: `Doc with id ${NewData.id} doesn't exist`,
    });

  // Before any file moves: every wanted group must exist
  const nextGroups = wantedGroups && [...new Set(wantedGroups)];
  const unknown = nextGroups?.find((g) => !groupsDB.data[g]);
  if (unknown)
    throw new ORPCError("BAD_REQUEST", {
      message: `Group ${unknown} doesn't exist`,
    });

  // To change file Name when content Title is changed
  if (NewData.title !== OldData?.title) {
    switch (OldData.type) {
      case "img":
      case "video": {
        const mvOperationData = [
          {
            baseDir: `./media/${CTypeDir[OldData.type]}`,
            oldPath: `${OldData.title}.${OldData.id}`,
            newPath: `${NewData.title}.${OldData.id}`,
          },
        ];

        // Videos may have no cover
        const coversDir = `./media/${CTypeDir[OldData.type]}/.covers`;
        const oldCover = `cover.${OldData.title}.${OldData.id}`;
        if (await hasBasename(coversDir, oldCover))
          mvOperationData.push({
            baseDir: coversDir,
            oldPath: oldCover,
            newPath: `cover.${NewData.title}.${OldData.id}`,
          });

        if (OldData.type === "video" && OldData.tags.includes(CAPTION_TAG))
          mvOperationData.push({
            baseDir: `./media/${CTypeDir[OldData.type]}/.captions`,
            oldPath: `caption.${OldData.title}.${OldData.id}`,
            newPath: `caption.${NewData.title}.${OldData.id}`,
          });

        const completed = [];
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
      }
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
  // Joining/leaving goes through the groups ops (cover set once, group `lastUpdated`); they mutate the stored record, so run them after the merge (a joined cover uses the new title)
  let groupsChanged = false;
  if (nextGroups) {
    const state = { contentData: contentDataDB.data, groups: groupsDB.data };
    const now = Math.floor(Date.now() / 1000);
    const had = OldData.groups ?? [];
    const itemIds = [NewData.id];
    const joined = nextGroups.filter((g) => !had.includes(g));
    const left = had.filter((g) => !nextGroups.includes(g));
    for (const id of joined) addGroupItems(state, { id, itemIds }, now);
    for (const id of left) removeGroupItems(state, { id, itemIds }, now);
    groupsChanged = joined.length + left.length > 0;
  }

  await contentDataDB.write();
  await tagDB.write();
  if (groupsChanged) await groupsDB.write();
  console.log(`Contents of ${NewData.id} Updated`);
  return updatedData;
}
