import { rename } from "node:fs/promises";
import { ORPCError } from "@orpc/server";
import { sanitizeStringForFileName } from "@tagapp/utils";
import type { CType } from "@tagapp/utils/types";
import { pathExists } from "../lib/fsBaseNameFunctions.js";
import { withSyncLock } from "../lib/syncLock.js";
import { filesOf, getSyncData, SYNC } from "./getSyncData.js";
import { splitTData } from "./prepareSync.js";

/**
 * Re-scans ./Sync and finds the item by its current disk name. Bundles are split first
 * (as prepareSync would) so the item's own sidecar is the only metadata copy and wins.
 * The match is against scanned entries, so a client-supplied name never reaches a path unchecked.
 */
async function findItem(name: string, type: CType) {
  await splitTData();
  const { contents } = await getSyncData();
  const item = Object.values(contents).find(
    (c) => c.name === name && c.type === type,
  );
  if (!item)
    throw new ORPCError("NOT_FOUND", {
      message: `"${name}" is not waiting in Sync`,
    });
  return item;
}

/** Overwrites the item's sidecar (also pins a generated id); prepareSync renames the files to the new title. */
export const editSyncItem = (input: {
  name: string;
  type: CType;
  title: string;
  tags: string[];
  extraData: string;
}) =>
  withSyncLock(async () => {
    // the sanitizer turns a blank title into "-", so check before it
    if (!input.title.trim())
      throw new ORPCError("BAD_REQUEST", {
        message: "Title must not be blank",
      });
    const { name, type, ext, ...rest } = await findItem(input.name, input.type);
    const title = sanitizeStringForFileName(input.title.trim());
    await Bun.write(
      `${SYNC}/${name}.json`,
      JSON.stringify({
        ...rest,
        title,
        tags: input.tags,
        extraData: input.extraData,
      }),
    );
  });

/** Moves the item's files and sidecar to ./UnSyncable (nothing is deleted); rolls back on failure. */
export const removeSyncItem = (input: { name: string; type: CType }) =>
  withSyncLock(async () => {
    const { name, type, ext } = await findItem(input.name, input.type);
    const sidecar = `${name}.json`;
    const names = filesOf(name, type, ext);
    if (await pathExists(`${SYNC}/${sidecar}`)) names.push(sidecar);

    // rename would silently replace an earlier leftover of the same name
    for (const f of names)
      if (await pathExists(`./UnSyncable/${f}`))
        throw new ORPCError("CONFLICT", {
          message: `UnSyncable already has "${f}"`,
        });

    const moved: string[] = [];
    try {
      for (const f of names) {
        await rename(`${SYNC}/${f}`, `./UnSyncable/${f}`);
        moved.push(f);
      }
    } catch (error) {
      for (const f of moved.reverse())
        await rename(`./UnSyncable/${f}`, `${SYNC}/${f}`).catch((e) =>
          console.error(`Failed to rollback ${f}:`, e),
        );
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Could not move "${name}": ${error}`,
      });
    }
  });
