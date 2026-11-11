import { ORPCError } from "@orpc/server";
import {
  applyTagDelta,
  type GroupState,
  groupChildren,
  planDeleteGroup,
  type TagDelta,
} from "@tagapp/utils";
import type { GroupDeleteType, GroupType } from "@tagapp/utils/types";
import { contentDataDB } from "../db/contentData.js";
import { groupsDB } from "../db/groups.js";
import { DecrementTagCount, IncrementTagCount, tagDB } from "../db/tags.js";
import { withSyncLock } from "../lib/syncLock.js";
import { deleteData } from "./deleteData.js";

const nowSec = () => Math.floor(Date.now() / 1000);

/** The live DB data. Never keep it across an `await`: sync swaps `contentDataDB.data` for a new object. */
const state = (): GroupState => ({
  contentData: contentDataDB.data,
  groups: groupsDB.data,
});

const badRequest = (e: unknown) =>
  new ORPCError("BAD_REQUEST", { message: (e as Error).message });

/** Writes the DBs; a memory change the disk never got is undone by re-reading the files. */
async function persist(w: {
  content?: boolean;
  groups?: boolean;
  tags?: boolean;
}) {
  try {
    await Promise.all([
      w.content && contentDataDB.write(),
      w.groups && groupsDB.write(),
      w.tags && tagDB.write(),
    ]);
  } catch (error) {
    await Promise.all([
      contentDataDB.read(),
      groupsDB.read(),
      tagDB.read(),
    ]).catch((e) => console.error("Could not reload the DBs:", e));
    throw error;
  }
}

/**
 * Runs a pure group op (from `@tagapp/utils`) on the live data under the sync lock, applies its tag
 * delta, then writes. Op errors are bad input (they throw before changing anything).
 */
export const runGroupOp = <R extends object>(
  op: (s: GroupState, now: number) => R,
  touches: { content?: boolean } = {},
) =>
  withSyncLock(async () => {
    let result: R;
    try {
      result = op(state(), nowSec());
    } catch (e) {
      throw badRequest(e);
    }
    const delta = (result as { tagDelta?: TagDelta }).tagDelta ?? {};
    const tags = Object.keys(delta).length > 0;
    if (tags) applyTagDelta(tagDB.data, delta);
    await persist({ content: touches.content, groups: true, tags });
    return result;
  });

/**
 * What the delete dialog shows: children only in this group, and children also in other groups (the
 * user picks which of those to delete as well).
 */
export const planGroupDelete = (id: string) =>
  withSyncLock(async () => {
    try {
      const { remove, detach } = planDeleteGroup(state(), {
        id,
        deleteIds: [],
      });
      return { exclusive: remove, shared: detach };
    } catch (e) {
      throw badRequest(e);
    }
  });

/**
 * Deletes the exclusive children and the chosen shared ones through the library's delete path
 * (`deleteData`: two-phase, rolled back per item), and only then drops the group record and the
 * id from the shared children that stay. If some item could not be deleted the group is kept (the
 * items already deleted stay deleted; retry).
 */
export const deleteGroupWithItems = (input: GroupDeleteType) =>
  withSyncLock(async () => {
    let remove: { id: string }[];
    try {
      ({ remove } = planDeleteGroup(state(), input));
    } catch (e) {
      throw badRequest(e);
    }
    const ids = remove.map((i) => i.id);
    const deleted = ids.length ? await deleteData(ids) : [];
    if (deleted.length < ids.length)
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Deleted ${deleted.length} of ${ids.length} items; the group was kept. See the server log.`,
      });

    // the deleted items are out of contentData now: only the shared ones that stay are left to detach
    const s = state();
    const detached = groupChildren(s.contentData, input.id).map((i) => i.id);
    const group = s.groups[input.id];
    if (!group) throw new ORPCError("NOT_FOUND");
    for (const id of detached) {
      const item = s.contentData[id];
      if (!item) continue;
      const rest = (item.groups ?? []).filter((g) => g !== input.id);
      if (rest.length) item.groups = rest;
      else delete item.groups;
      item.lastUpdated = nowSec();
    }
    delete s.groups[input.id];
    DecrementTagCount(group.tags);
    await persist({ content: true, groups: true, tags: true });
    return { deleted, detached, group };
  });

const stub = (id: string, now: number): GroupType => ({
  id,
  title: id,
  extraData: "",
  tags: [],
  added: now,
  lastUpdated: now,
});

/** Group records for ids no record exists for (`title = id`, no cover). In memory only, see `addMissingGroups`. */
export const stubsFor = (ids: string[] | undefined) =>
  [...new Set(ids ?? [])]
    .filter((id) => !groupsDB.data[id])
    .map((id) => stub(id, nowSec()));

/**
 * Adds the records whose id is unknown (existing ones are never overwritten, the incoming `cover` is
 * dropped) and counts their tags. In memory only: the caller writes `groupsDB` and `tagDB`, or calls
 * `dropGroups(added)` to undo.
 */
export function addMissingGroups(records: GroupType[]) {
  const added: GroupType[] = [];
  for (const record of records) {
    if (groupsDB.data[record.id]) continue;
    const group = { ...record, tags: [...new Set(record.tags)] };
    delete group.cover;
    groupsDB.data[group.id] = group;
    IncrementTagCount(group.tags);
    added.push(group);
  }
  return added;
}

export function dropGroups(added: GroupType[]) {
  for (const g of added) {
    delete groupsDB.data[g.id];
    DecrementTagCount(g.tags);
  }
}

/** `POST /downloads/set`: the Vault wins, so only unknown ids are registered. */
export const registerGroups = (records: GroupType[]) =>
  withSyncLock(async () => {
    const added = addMissingGroups(records);
    if (added.length) await persist({ groups: true, tags: true });
    return added.map((g) => g.id);
  });
