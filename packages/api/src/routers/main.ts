import { tagDB } from "../db/tags.js";
import { FilterQuerySchema, filterData } from "@tagapp/utils";
import { deleteData as deleteDocs } from "../services/deleteData.js";
import { setDoc as set } from "../services/setDoc.js";
import { syncContent } from "../services/syncContent.js";
import { ORPCError, os } from "@orpc/server";
import z from "zod";

// TODO: Setup getSyncData for editing functionality before syncing it up
import { getSyncData as gtSyncData } from "../services/getSyncData.js";
import { contentDataDB } from "../db/contentData.js";
import { settingsDB } from "../db/settings.js";
export const getSyncData = os.handler(gtSyncData);

export const sync = os.handler(syncContent);

const docValidator = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.string().array(),
  extraData: z.string(),
});

export type DocType = z.infer<typeof docValidator>;

export const setContent = os
  .input(docValidator)
  .handler(async ({ input }) => await set(input));

export const setCover = os
  .input(
    z.object({
      coverPath: z.string().optional(),
      id: z.string(),
      name: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    contentDataDB.data[input.id]!.cover = input.coverPath;
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
    input.ids.forEach((id) => {
      const contentDetails = contentDataDB.data[id];

      if (!contentDetails)
        throw new ORPCError("BAD_REQUEST", {
          message: `Content with id ${id} doesn't exist`,
        });

      input.removed.forEach((tag) => {
        if (tagDB.data[tag]) tagDB.data[tag]--;
        else delete tagDB.data[tag];
      });
      contentDetails.tags = contentDetails.tags.filter(
        (tag) => !input.removed.includes(tag),
      );

      input.added.forEach((tag) => {
        tagDB.data[tag] ??= 0;
        tagDB.data[tag]++;
      });
      contentDetails.tags = [
        ...new Set([...contentDetails.tags, ...input.added]),
      ];
    });

    await contentDataDB.write();
    await tagDB.write();
    return input;
  });

export const removeContents = os
  .input(z.string().array())
  .handler(async ({ input }) => await deleteDocs(input));

export const getFilteredData = os
  .input(FilterQuerySchema)
  .handler(async ({ input }) => {
    console.log("Data requested");
    return filterData(input, contentDataDB.data);
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
