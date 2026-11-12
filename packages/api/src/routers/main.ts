import { ORPCError, os } from "@orpc/server";
import { SetDifferenceES6 } from "@tagapp/utils";
import { CtypeSchema, GroupSchema } from "@tagapp/utils/types";
import z from "zod";
import { contentDataDB } from "../db/contentData.js";
import { settingsDB } from "../db/settings.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { withSyncLock } from "../lib/syncLock.js";
import { deleteData as deleteDocs } from "../services/deleteData.js";
import { getSyncData as gtSyncData } from "../services/getSyncData.js";
import { setDoc as set } from "../services/setDoc.js";
import { syncContent } from "../services/syncContent.js";
import {
  bulkEditSyncItems as bulkEditSync,
  bulkRemoveSyncItems as bulkRemoveSync,
  editSyncItem as editSync,
  removeSyncItem as removeSync,
} from "../services/syncItem.js";
export const getSyncData = os.handler(() => withSyncLock(gtSyncData));

export const sync = os.handler(() => syncContent());

// `name` is the item's current disk name from getSyncData; the service re-scans to find it
const syncItemRef = z.object({
  name: z
    .string()
    .min(1)
    .refine((n) => !/[/\\]/.test(n)),
  type: CtypeSchema,
});

export const editSyncItem = os
  .input(
    syncItemRef.extend({
      title: z.string(),
      tags: z.string().array(),
      extraData: z.string(),
      groups: z.string().array().optional(),
      newGroups: GroupSchema.array().optional(),
    }),
  )
  .handler(({ input }) => editSync(input));

// Tags (`added` / `removed`) and group ids (`addGroups`; ids the server lacks need a record in `newGroups`) on several pending items at once
export const bulkEditSyncItems = os
  .input(
    z.object({
      items: syncItemRef.array().min(1),
      added: z.string().array().optional(),
      removed: z.string().array().optional(),
      addGroups: z.string().array().optional(),
      newGroups: GroupSchema.array().optional(),
    }),
  )
  .handler(({ input }) => bulkEditSync(input));

export const bulkRemoveSyncItems = os
  .input(z.object({ items: syncItemRef.array().min(1) }))
  .handler(({ input }) => bulkRemoveSync(input.items));

export const removeSyncItem = os
  .input(syncItemRef)
  .handler(({ input }) => removeSync(input));

const docValidator = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.string().array(),
  extraData: z.string(),
  groups: z.string().array().optional(),
});

export type DocType = z.infer<typeof docValidator>;

export const setContent = os
  .input(docValidator)
  .handler(({ input }) => withSyncLock(() => set(input)));

export const setCover = os
  .input(
    z.object({
      coverPath: z.string().optional(),
      id: z.string(),
      name: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const content = contentDataDB.data[input.id];
    if (!content)
      throw new ORPCError("NOT_FOUND", {
        message: `Content with id ${input.id} doesn't exist`,
      });
    content.cover = input.coverPath;
    await contentDataDB.write();
    console.log(`Succefully updated Cover of ${input.name}`);
    return input;
  });

export const bulkUpdateContentTags = os
  .input(
    z.object({
      ids: z.string().array(),
      added: z.string().array(),
      removed: z.string().array(),
    }),
  )
  .handler(async ({ input }) => {
    // Validate every id first so a bad id can't leave earlier items half-updated in memory
    const items = input.ids.map((id) => {
      const item = contentDataDB.data[id];
      if (!item)
        throw new ORPCError("BAD_REQUEST", {
          message: `Content with id ${id} doesn't exist`,
        });
      return item;
    });

    for (const contentDetails of items) {
      const before = new Set(contentDetails.tags);
      // A tag in both lists ends up on the item (added wins)
      contentDetails.tags = [
        ...new Set([
          ...contentDetails.tags.filter((tag) => !input.removed.includes(tag)),
          ...input.added,
        ]),
      ];
      const after = new Set(contentDetails.tags);
      DecrementTagCount(SetDifferenceES6(before, after));
      IncrementTagCount(SetDifferenceES6(after, before));
    }

    await contentDataDB.write();
    await tagDB.write();
    return input;
  });

export const removeContents = os
  .input(z.string().array())
  .handler(async ({ input }) => await deleteDocs(input));

export const getAllContent = os.handler(async () => {
  console.log("All data requested");
  return contentDataDB.data;
});

export const getContent = os
  .input(z.object({ id: z.string() }))
  .handler(async ({ input: { id } }) => {
    const Data = contentDataDB.data[id];

    if (!Data) throw new ORPCError("NOT_FOUND");

    console.log(`${Data.title} - ${id} data requested`);
    return Data;
  });

export const getServerTags = os.handler(async () => {
  const Data = tagDB.data;
  return Data;
});

export const getSettings = os.handler(async () => {
  return settingsDB.data;
});
