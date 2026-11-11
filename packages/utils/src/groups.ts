import type {
  ContentJsonType,
  GroupChangeIdType,
  GroupCoverPickType,
  GroupCreateType,
  GroupDeleteType,
  GroupFixType,
  GroupItemsType,
  GroupMergeType,
  GroupSortType,
  GroupsDB,
  GroupType,
  GroupUpdateType,
} from "./types";

// Works on any item with `groups?` (server, web or queue rows).
type Item = ContentJsonType;
type Items<T extends Item = Item> = Record<string, T>;

/** Tag -> change of its count (`DB/tags.json`). Only non-zero entries are present. */
export type TagDelta = Record<string, number>;

const GROUP_ID_ALPHABET =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

/** `grp_<10 url-safe chars>`, same shape as 6.0's nanoid ids. (nanoid isn't a dependency of utils.) */
export function newGroupId() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = "grp_";
  for (const b of bytes) id += GROUP_ID_ALPHABET[b & 63];
  return id;
}

// ── Read helpers ──
// shortcut: children and tag stats are recomputed from the full content record on every call, nothing
// is stored; revisit at ~20k items (the real limits are the full-library payload and Fuse description search).

/** Items of one group. */
export const groupChildren = <T extends Item>(
  contentData: Items<T>,
  id: string,
) => Object.values(contentData).filter((c) => c.groups?.includes(id));

/** Items of every group, one pass. */
export const childrenByGroup = <T extends Item>(contentData: Items<T>) => {
  const map: Record<string, T[]> = {};
  for (const c of Object.values(contentData))
    for (const id of new Set(c.groups)) {
      map[id] ??= [];
      map[id].push(c);
    }
  return map;
};

/** Tag -> number of the given children carrying it (a duplicated tag counts once per item). */
export const groupTagStats = (children: Item[]) => {
  const stats: Record<string, number> = {};
  for (const c of children)
    for (const tag of new Set(c.tags)) stats[tag] = (stats[tag] ?? 0) + 1;
  return stats;
};

/** Children that also belong to another group (the ones a group delete asks about). */
export const sharedChildren = <T extends Item>(children: T[]) =>
  children.filter((c) => (c.groups?.length ?? 0) > 1);

/** The group's own cover, else a child's by `pick`. Plain URL, or undefined. */
export const pickGroupCover = (
  group: Pick<GroupType, "cover">,
  children: Pick<Item, "cover" | "added">[],
  pick: GroupCoverPickType = "newest",
) => {
  if (group.cover) return group.cover;
  const ordered =
    pick === "firstWithCover"
      ? children
      : [...children].sort((a, b) =>
          pick === "newest" ? b.added - a.added : a.added - b.added,
        );
  return ordered.find((c) => c.cover)?.cover;
};

/** Sort position of a group card. Without children `newestChild` falls back to `added`. */
export const groupSortKey = (
  group: GroupType,
  children: Pick<Item, "added">[],
  mode: GroupSortType = "newestChild",
) =>
  mode === "created"
    ? group.added
    : mode === "updated"
      ? group.lastUpdated
      : children.length
        ? Math.max(...children.map((c) => c.added))
        : group.added;

/** Distinct group ids on the given items. */
export const groupIdsOf = (items: Item[]) => [
  ...new Set(items.flatMap((i) => i.groups ?? [])),
];

/** Group records referenced by the given items (ids without a record are skipped). */
export const referencedGroups = (items: Item[], groups: GroupsDB) =>
  groupIdsOf(items).flatMap((id) => groups[id] ?? []);

// ── Tag counts ──

const delta = () => {
  const d: TagDelta = {};
  const add = (tags: Iterable<string>, by: 1 | -1) => {
    for (const tag of new Set(tags)) d[tag] = (d[tag] ?? 0) + by;
  };
  return {
    add,
    done: () => Object.fromEntries(Object.entries(d).filter(([, n]) => n)),
  };
};

/** Applies a delta to `DB/tags.json` data the way `IncrementTagCount`/`DecrementTagCount` do: a tag dropping below 1 is deleted, unknown tags are not created by a decrement. */
export function applyTagDelta(tags: Record<string, number>, d: TagDelta) {
  for (const [tag, n] of Object.entries(d)) {
    if (n > 0) tags[tag] = (tags[tag] ?? 0) + n;
    else if (tag in tags) {
      const next = (tags[tag] ?? 0) + n;
      if (next < 1) delete tags[tag];
      else tags[tag] = next;
    }
  }
}

// ── Operations ──
// Each mutates `state` in place (item `groups`/`lastUpdated`, the group records) and returns what
// changed plus the group-tag delta. Pass a structuredClone when atomicity matters (write only after
// the filesystem work succeeded). Item deletion is NOT done here: `deleteGroup` returns the plan.
// They throw `Error` for bad input, before any change.

export type GroupState<T extends Item = Item> = {
  contentData: Items<T>;
  groups: GroupsDB;
};

const need = (s: GroupState, id: string) => {
  const group = s.groups[id];
  if (!group) throw new Error(`Group ${id} doesn't exist`);
  return group;
};

const needItems = (s: GroupState, ids: string[]) =>
  [...new Set(ids)].map((id) => {
    const item = s.contentData[id];
    if (!item) throw new Error(`Content with id ${id} doesn't exist`);
    return item;
  });

const setItemGroups = (item: Item, ids: string[], now: number) => {
  if (ids.length) item.groups = ids;
  else delete item.groups;
  item.lastUpdated = now;
};

export function createGroup(
  s: GroupState,
  input: GroupCreateType,
  now: number,
) {
  const id = input.id.trim();
  if (!id) throw new Error("Group id is empty");
  if (s.groups[id]) throw new Error(`Group ${id} already exists`);
  const tags = [...new Set(input.tags)];
  const group: GroupType = {
    id,
    title: input.title.trim(),
    extraData: input.extraData,
    tags,
    cover: input.cover || undefined,
    added: now,
    lastUpdated: now,
  };
  s.groups[id] = group;
  const d = delta();
  d.add(tags, 1);
  return { group, tagDelta: d.done() };
}

export function updateGroup(
  s: GroupState,
  input: GroupUpdateType,
  now: number,
) {
  const group = need(s, input.id);
  const d = delta();
  if (input.tags) {
    const tags = [...new Set(input.tags)];
    d.add(group.tags, -1);
    d.add(tags, 1);
    group.tags = tags;
  }
  if (input.title !== undefined) group.title = input.title.trim();
  if (input.extraData !== undefined) group.extraData = input.extraData;
  if (input.cover !== undefined) group.cover = input.cover || undefined; // "" clears it
  group.lastUpdated = now;
  return { group, tagDelta: d.done() };
}

/** Adds the group id to the items. Returns the items that changed. */
export function addGroupItems(
  s: GroupState,
  input: GroupItemsType,
  now: number,
) {
  const group = need(s, input.id);
  const changed = needItems(s, input.itemIds).filter(
    (i) => !i.groups?.includes(input.id),
  );
  for (const item of changed)
    setItemGroups(item, [...(item.groups ?? []), input.id], now);
  if (changed.length) group.lastUpdated = now;
  return { group, changed };
}

/** Removes the group id from the items. Returns the items that changed. */
export function removeGroupItems(
  s: GroupState,
  input: GroupItemsType,
  now: number,
) {
  const group = need(s, input.id);
  const changed = needItems(s, input.itemIds).filter((i) =>
    i.groups?.includes(input.id),
  );
  for (const item of changed)
    setItemGroups(
      item,
      (item.groups ?? []).filter((g) => g !== input.id),
      now,
    );
  if (changed.length) group.lastUpdated = now;
  return { group, changed };
}

/** Drops the group record and its id from every child. Items stay. */
export function disbandGroup(
  s: GroupState,
  input: { id: string },
  now: number,
) {
  const group = need(s, input.id);
  const children = groupChildren(s.contentData, input.id);
  for (const item of children)
    setItemGroups(
      item,
      (item.groups ?? []).filter((g) => g !== input.id),
      now,
    );
  delete s.groups[input.id];
  const d = delta();
  d.add(group.tags, -1);
  return { group, changed: children, tagDelta: d.done() };
}

/**
 * Read-only plan of a group delete: exclusive children (and the shared ones in `deleteIds`) are to
 * be deleted; the other shared children only lose this id (`detach`). The caller deletes the items
 * through the Vault's delete path first, then applies `deleteGroup`.
 */
export function planDeleteGroup<T extends Item>(
  s: GroupState<T>,
  input: GroupDeleteType,
) {
  need(s, input.id);
  const remove: T[] = [];
  const detach: T[] = [];
  for (const item of groupChildren(s.contentData, input.id))
    if (
      !item.groups?.some((g) => g !== input.id) ||
      input.deleteIds.includes(item.id)
    )
      remove.push(item);
    else detach.push(item);
  return { remove, detach };
}

/**
 * Applies the plan to the state: the shared items kept lose this id, the group record goes, and the
 * planned items are dropped from `contentData` (their own tag counts are the caller's, via its delete path).
 * Returns the plan plus the group's tag delta.
 */
export function deleteGroup<T extends Item>(
  s: GroupState<T>,
  input: GroupDeleteType,
  now: number,
) {
  const plan = planDeleteGroup(s, input);
  const group = need(s, input.id);
  for (const item of plan.detach)
    setItemGroups(
      item,
      (item.groups ?? []).filter((g) => g !== input.id),
      now,
    );
  for (const item of plan.remove) delete s.contentData[item.id];
  delete s.groups[input.id];
  const d = delta();
  d.add(group.tags, -1);
  return { ...plan, group, tagDelta: d.done() };
}

/**
 * Recreates missing group records for ids found on items (`title = id`, no cover) and clears an
 * empty-string cover. Nothing else. `id` limits it to one group.
 */
export function fixGroups(s: GroupState, input: GroupFixType, now: number) {
  const created: string[] = [];
  const cleared: string[] = [];
  const ids = input.id
    ? [input.id]
    : [...Object.keys(s.groups), ...groupIdsOf(Object.values(s.contentData))];
  for (const id of new Set(ids)) {
    const group = s.groups[id];
    if (!group) {
      if (!groupChildren(s.contentData, id).length) continue;
      s.groups[id] = {
        id,
        title: id,
        extraData: "",
        tags: [],
        added: now,
        lastUpdated: now,
      };
      created.push(id);
    } else if (group.cover === "") {
      group.cover = undefined;
      group.lastUpdated = now;
      cleared.push(id);
    }
  }
  return { created, cleared }; // no tags change: recreated groups have none
}

/** Tags = union; title, extraData and cover stay the kept group's; every child is re-pointed. */
export function mergeGroups(s: GroupState, input: GroupMergeType, now: number) {
  const ids = [...new Set(input.ids)];
  if (ids.length < 2 || !ids.includes(input.keepId))
    throw new Error("Merge needs at least two groups, including the kept one");
  const merging = ids.map((id) => need(s, id));
  const kept = need(s, input.keepId);
  const others = ids.filter((id) => id !== input.keepId);
  const tags = [...new Set(merging.flatMap((g) => g.tags))];
  const d = delta();
  for (const g of merging) d.add(g.tags, -1);
  d.add(tags, 1);
  kept.tags = tags;
  kept.lastUpdated = now;

  const changed: Item[] = [];
  for (const item of Object.values(s.contentData)) {
    if (!item.groups?.some((g) => others.includes(g))) continue;
    setItemGroups(
      item,
      [
        ...new Set(
          item.groups.map((g) => (others.includes(g) ? input.keepId : g)),
        ),
      ],
      now,
    );
    changed.push(item);
  }
  for (const id of others) delete s.groups[id];
  return { group: kept, changed, tagDelta: d.done() };
}

/** Re-keys a group and rewrites the id on every item. An existing `newId` means merge into it. */
export function changeGroupId(
  s: GroupState,
  input: GroupChangeIdType,
  now: number,
) {
  const { oldId } = input;
  const newId = input.newId.trim();
  if (!newId) throw new Error("Group id is empty");
  const group = need(s, oldId);
  if (newId === oldId) return { group, changed: [] as Item[], tagDelta: {} };
  if (s.groups[newId])
    return mergeGroups(s, { ids: [oldId, newId], keepId: newId }, now);

  delete s.groups[oldId];
  group.id = newId;
  group.lastUpdated = now;
  s.groups[newId] = group;
  const changed = groupChildren(s.contentData, oldId);
  for (const item of changed)
    setItemGroups(
      item,
      (item.groups ?? []).map((g) => (g === oldId ? newId : g)),
      now,
    );
  return { group, changed, tagDelta: {} as TagDelta };
}
