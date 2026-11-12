import { CAPTION_TAG, RESERVED_TAGS } from "@tagapp/utils";
import { safeTitle } from "@tagapp/utils/download";
import z from "zod";
import { contentDataDB } from "../db/contentData.js";
import { withSyncLock } from "../lib/syncLock.js";
import { setDoc } from "./setDoc.js";

/** Body of `POST /content/sync`: the extension's title, tags and extraData per id (a subset of `ContentWebType`). */
export const contentSyncSchema = z.object({
  items: z
    .object({
      id: z.string(),
      title: z.string(),
      tags: z.string().array(),
      extraData: z.string(),
    })
    .array(),
});

export type ContentSyncResult = {
  updated: string[];
  missing: string[];
  failed: { id: string; error: string }[];
};

/**
 * Overwrites title, tags and extraData of library items with the given values (the extension wins).
 * The Vault owns `RESERVED_TAGS`: a reserved tag the item has stays even when absent from the
 * incoming list, and `meta:caption` (derived from the caption file) is never added from outside.
 * Items go through `setDoc` one by one, so rename, rollback and tag counts are the usual ones;
 * a failing item is reported and does not stop the rest. Unchanged items are not touched.
 */
export const overwriteContent = ({
  items,
}: z.infer<typeof contentSyncSchema>) =>
  withSyncLock(async () => {
    const result: ContentSyncResult = { updated: [], missing: [], failed: [] };
    const reserved = new Set<string>(RESERVED_TAGS);
    for (const item of items) {
      // hasOwn: ids come from outside; `__proto__` etc. must count as missing
      const old = Object.hasOwn(contentDataDB.data, item.id)
        ? contentDataDB.data[item.id]
        : undefined;
      if (!old) {
        result.missing.push(item.id);
        continue;
      }
      const title = safeTitle(item.title);
      const tags = [
        ...new Set([
          ...item.tags.filter((t) => t !== CAPTION_TAG),
          ...old.tags.filter((t) => reserved.has(t)),
        ]),
      ];
      const same =
        title === old.title &&
        item.extraData === old.extraData &&
        tags.length === old.tags.length &&
        tags.every((t) => old.tags.includes(t));
      if (same) continue;
      try {
        if (!title) throw new Error("Title is empty");
        await setDoc({ id: item.id, title, tags, extraData: item.extraData });
        result.updated.push(item.id);
      } catch (e) {
        result.failed.push({
          id: item.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return result;
  });
