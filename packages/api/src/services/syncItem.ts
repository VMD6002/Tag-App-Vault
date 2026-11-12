import { rename } from "node:fs/promises";
import { ORPCError } from "@orpc/server";
import { sanitizeStringForFileName } from "@tagapp/utils";
import type { CType, GroupType } from "@tagapp/utils/types";
import { groupsDB } from "../db/groups.js";
import { pathExists } from "../lib/fsBaseNameFunctions.js";
import { withSyncLock } from "../lib/syncLock.js";
import { filesOf, getSyncData, SYNC } from "./getSyncData.js";
import { addMissingGroups, dropGroups, persist } from "./groups.js";
import { splitTData } from "./prepareSync.js";

type Ref = { name: string; type: CType };

/**
 * Re-scans ./Sync and finds the items by their current disk name. Bundles are split first
 * (as prepareSync would) so an item's own sidecar is the only metadata copy and wins.
 * The match is against scanned entries, so a client-supplied name never reaches a path unchecked.
 * One missing item fails the whole call (`NOT_FOUND`) before anything is written; repeats count once.
 */
async function findItems(refs: Ref[]) {
  await splitTData();
  const { contents } = await getSyncData();
  const all = Object.values(contents);
  const found = new Map<string, (typeof all)[number]>();
  for (const { name, type } of refs) {
    const item = all.find((c) => c.name === name && c.type === type);
    if (!item)
      throw new ORPCError("NOT_FOUND", {
        message: `"${name}" is not waiting in Sync`,
      });
    found.set(`${type}/${name}`, item);
  }
  return [...found.values()];
}

/**
 * Groups new to an item must have a record, on the server or in `records` (what the extension
 * injected into the page); ids it already carries (e.g. not registered yet) are kept as they are.
 * Returns the records to register: ids the server has none for.
 */
function newGroupRecords(
  ids: string[],
  current: string[] = [],
  records: GroupType[] = [],
) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const unknown = ids.filter(
    (g) => !current.includes(g) && !groupsDB.data[g] && !byId.has(g),
  );
  if (unknown.length)
    throw new ORPCError("BAD_REQUEST", {
      message: `Unknown group: ${unknown.join(", ")}`,
    });
  return ids.flatMap((id) => {
    const record = byId.get(id);
    return record && !groupsDB.data[id] ? [record] : [];
  });
}

/**
 * Registers `records` like `POST /downloads/set` does (`addMissingGroups`: the Vault wins, the incoming
 * cover is dropped, tags counted) and writes the DBs, then runs `write`; if that fails the groups are
 * dropped again. Call under `withSyncLock`.
 */
async function withRegistered<T>(
  records: GroupType[],
  write: () => Promise<T>,
) {
  const added = addMissingGroups(records);
  if (!added.length) return write();
  await persist({ groups: true, tags: true });
  try {
    return await write();
  } catch (error) {
    dropGroups(added);
    await persist({ groups: true, tags: true }).catch((e) =>
      console.error("Could not undo the group registration:", e),
    );
    throw error;
  }
}

/** Overwrites the item's sidecar (also pins a generated id); prepareSync renames the files to the new title. `groups` (the complete list, `[]` clears) is left alone when absent. */
export const editSyncItem = (input: {
  name: string;
  type: CType;
  title: string;
  tags: string[];
  extraData: string;
  groups?: string[];
  /** Records for `groups` ids the server has none for (registered like `/downloads/set`). */
  newGroups?: GroupType[];
}) =>
  withSyncLock(async () => {
    // the sanitizer turns a blank title into "-", so check before it
    if (!input.title.trim())
      throw new ORPCError("BAD_REQUEST", {
        message: "Title must not be blank",
      });
    const [found] = await findItems([input]);
    const { name, type, ext, ...rest } = found as NonNullable<typeof found>;
    const title = sanitizeStringForFileName(input.title.trim());
    const groups = input.groups && [...new Set(input.groups)];
    const records = groups
      ? newGroupRecords(groups, rest.groups, input.newGroups)
      : [];
    await withRegistered(records, () =>
      Bun.write(
        `${SYNC}/${name}.json`,
        JSON.stringify({
          ...rest,
          title,
          tags: input.tags,
          extraData: input.extraData,
          ...(groups && { groups: groups.length ? groups : undefined }),
        }),
      ),
    );
  });

/**
 * Tags and groups of several pending items in one call: per item tags = current minus `removed`
 * plus `added` (added wins) and `addGroups` joined. Only the sidecars change; groups are applied
 * (record stub, set-once cover) by the next sync, tag counts too. Items whose result is
 * identical are not written. A failed write restores the sidecars already written. `newGroups`
 * records for ids the server does not know are registered first (only when something is written).
 * Returns the ids of the items that changed.
 */
export const bulkEditSyncItems = (input: {
  items: Ref[];
  added?: string[];
  removed?: string[];
  addGroups?: string[];
  /** Records for `addGroups` ids the server has none for (registered like `/downloads/set`). */
  newGroups?: GroupType[];
}) =>
  withSyncLock(async () => {
    const added = [...new Set((input.added ?? []).map((t) => t.trim()))].filter(
      Boolean,
    );
    const removed = input.removed ?? [];
    const addGroups = [...new Set(input.addGroups ?? [])];
    const records = newGroupRecords(addGroups, [], input.newGroups);
    const items = await findItems(input.items);

    const writes = items.flatMap(({ name, type: _t, ext: _e, ...rest }) => {
      const tags = [
        ...new Set([
          ...rest.tags.filter((t) => !removed.includes(t)),
          ...added,
        ]),
      ];
      const groups = [...new Set([...(rest.groups ?? []), ...addGroups])];
      const same =
        tags.length === rest.tags.length &&
        tags.every((t, i) => t === rest.tags[i]) &&
        groups.length === (rest.groups ?? []).length;
      if (same) return [];
      return [
        {
          id: rest.id,
          path: `${SYNC}/${name}.json`,
          next: JSON.stringify({
            ...rest,
            tags,
            groups: groups.length ? groups : undefined,
          }),
        },
      ];
    });

    await withRegistered(writes.length ? records : [], async () => {
      // sidecar text before the write (null: there was none), to put back on failure
      const before: [string, string | null][] = [];
      try {
        for (const { path, next } of writes) {
          const file = Bun.file(path);
          before.push([path, (await file.exists()) ? await file.text() : null]);
          await Bun.write(path, next);
        }
      } catch (error) {
        for (const [path, text] of before.reverse())
          await (text === null
            ? Bun.file(path).delete()
            : Bun.write(path, text)
          ).catch((e) => console.error(`Failed to rollback ${path}:`, e));
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: `Could not update the sidecars: ${error}`,
        });
      }
    });
    return writes.map((w) => w.id);
  });

/**
 * Moves the files and sidecars of the items to ./UnSyncable (nothing is deleted). A name already in
 * UnSyncable is a `CONFLICT` for the whole call; a failed move puts every moved file back.
 * Returns the ids of the removed items.
 */
export const bulkRemoveSyncItems = (refs: Ref[]) =>
  withSyncLock(async () => {
    const items = await findItems(refs);
    const names: string[] = [];
    for (const { name, type, ext } of items) {
      const sidecar = `${name}.json`;
      names.push(...filesOf(name, type, ext));
      if (await pathExists(`${SYNC}/${sidecar}`)) names.push(sidecar);
    }

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
        message: `Could not move "${items.map((i) => i.name).join('", "')}": ${error}`,
      });
    }
    return items.map((i) => i.id);
  });

export const removeSyncItem = (input: Ref) => bulkRemoveSyncItems([input]);
