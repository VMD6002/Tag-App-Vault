# Groups

A group is an extra index over library items (same topic or author): grouped items leave the main library and show as one card. Groups never nest (a group holds items only). No migration: `groups` is optional on items and `DB/groups.json` may be missing. Code: `packages/utils/src/{types/group,groups,filterData}.ts`, API `packages/api/src/{routers,services,db}/groups.ts`, UI `apps/web/src/routes/group/`, `components/craft/group/` and `components/craft/library/GroupCard.tsx`. The browser extension (TagApp 6.0) is a separate project that creates groups and sends them with its downloads.

## Data

- Item: `groups?: string[]` (group ids) on `ContentJsonSchema`, so also on `contentServerSchema` and `contentWebSchema`. **The item is the source of truth**; a group record is metadata. Deleting or renaming an item needs no group change (`setDoc` keeps `groups`).
- `GroupType` (`GroupSchema`): `{ id, title, extraData, tags: string[], cover?, added, lastUpdated }`, times in Unix seconds, `extraData` a markdown description. Ids are `grp_<10 chars>` (`newGroupId`; the 6.0 extension generates the same shape). Stored in `DB/groups.json` as `Record<id, GroupType>` ([disk layout](./disk-layout.md)).
- Group `tags` count in `DB/tags.json` like item tags; `fix.hardResetTagCount` includes them, and every group tag edit applies a `TagDelta`.
- Children and per-group tag stats are computed on the fly from the loaded content (`groupChildren`, `childrenByGroup`, `groupTagStats`, `sharedChildren`). No stored index. `shortcut:` comments in `groups.ts` and `filterData.ts`: revisit at roughly 20k items, where the real limits are the full-library payload and the Fuse description search.
- The Vault has no backup or restore feature, so nothing carries groups there.
- Reserved tag `view:in-library` (`VIEW_IN_LIBRARY_TAG`): a grouped item with it still shows in the main library. It is in `RESERVED_TAGS`, not in `VIEW_TAGS`: it is not a gallery display option ([domain model](./domain-model.md#view-tags)).

## Cover

`cover?` is a **plain URL string**: a child's `/media/...` cover URL or any external URL. Nothing is stored as a child id and nothing is resolved through one.

- Empty `cover`: the card computes a fallback from the children with the device-local cover pick (Settings): newest child (default), oldest, or first with a cover (`pickGroupCover`). A Vault item's own `cover` is a file name, so the web maps children through `getCoverUrl` first (`hooks/useGroupCover.ts`); a `media/…` result gets a leading `/`.
- "Edit" on `/group/:id` (and the card's Edit on `/group`) offers the children's cover URLs as quick picks (`/${getCoverUrl(child)}`) and accepts any URL; empty clears it.
- Fix Data clears an empty-string cover only. `POST /downloads/set` ignores the incoming `cover`.

## Library behaviour (`filterLibrary`)

`filterLibrary(query, contentData, groups)` returns `LibraryEntry[]`: `{kind:"item", item}` or `{kind:"group", group, children}`, sorted together ([domain model](./domain-model.md#library-filter-filterlibrary)). `filterData` is unchanged for sync and galleries.

- A grouped item (an id that has a record) is hidden from the library unless it has `view:in-library`, or "Show grouped items" is on. Ids without a record never hide an item.
- Group cards sit among the items. Groups without children are not shown there (they are on `/group`). Library cards offer only **Disband**.
- Card position: device-local group sort (Settings): newest child added (default), group created, or group `lastUpdated`.
- **Advanced search** (URL params `showGrouped`, `itemsOnly`, `searchDescription`, absent = off):
  - Mode 1 (default): titles of groups and of items; items inside a group do not appear unless they have `view:in-library`.
  - Mode 2 ("Items only"): items searched directly as before, groups excluded. The two modes are exclusive buttons.
  - "Search descriptions too" is independent: it adds `extraData` to the searched fields within the active mode.
- **Tag filters on cards**: a card matches when its own tags match or any child's tags match (`none` is a hard exclude on the group's own tags).

## Operations

Pure functions in `packages/utils/src/groups.ts`, `(state, input, now) => result`, mutating `state = { contentData, groups }` in place; they throw before any change on bad input and return the tag delta. The server runs them under `withSyncLock` and writes the DBs ([server API](./server-api.md#groups-router)); the web mock runs the same functions on its fake db.

| Op                         | Behaviour                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create`                   | `{title, id?, extraData?, tags?, cover?}`; fails if the id exists                                                                                                                                            |
| `update`                   | `{id, title?, extraData?, tags?, cover?}`; `cover: ""` clears; tag diff adjusts counts                                                                                                                       |
| `addItems` / `removeItems` | `{id, itemIds}`; unknown item ids throw before any change                                                                                                                                                    |
| `disband`                  | drop the record, strip the id from every child; items stay                                                                                                                                                   |
| `delete`                   | `{id, deleteIds}`: the exclusive children and the chosen shared ones go through the existing two-phase delete ([file operations](./file-operations.md#group-delete)); other shared children only lose the id |
| `planDelete`               | read-only `{exclusive, shared}` for the delete dialog                                                                                                                                                        |
| `fix`                      | `{id?}` (none = all): recreate missing records for ids found on items (`title = id`, no cover) and clear an empty-string cover. Nothing else                                                                 |
| `merge`                    | `{ids, keepId}`, at least two: children re-pointed to `keepId`, tags united, title/extraData/cover from the kept group, the others deleted                                                                   |
| `changeId`                 | `{oldId, newId}`: re-key the record and rewrite every item's `groups`; an existing `newId` merges into it (aligns ids with 6.0)                                                                              |

## Downloads and sync

- `POST /downloads/set` takes `{ items: ContentWebType[], groups: GroupType[] }` (no bare array). It registers groups the Vault does not know **at POST time**; the Vault wins: known ids are never overwritten and the incoming `cover` is dropped. The CLI, `tmp.json` and `Sync/` formats are unchanged ([server API](./server-api.md), [server downloads](./server-downloads.md)).
- Sync auto-creates every group id it does not know (`title = id`, no tags, no cover) with the item, and rolls it back with the item on failure ([sync pipeline](./sync-pipeline.md)).

## Pages (`apps/web`, details in [web app](./web-app.md))

- **Library `/`**: group cards, advanced search, "Add to group…" on cards and in the selection bar, groups and the `view:in-library` switch in the item edit modal (also on the item pages `/img/:id`…, and `/group/:id`).
- **`/group`** (`routes/group/index.tsx`, nav link "Groups"): every group including empty ones, title/id search, global **Fix Data**, per card Edit / Fix / Disband / Delete icon buttons (Edit includes the id, i.e. `changeId`), and "Select groups" for **Merge** (pick the id to keep), **Disband** and **Delete** of several groups. Deleting several groups opens the delete dialog for each in turn ("Group 2 of 3").
- **`/group/:id`** (`routes/group/[id].tsx`): the library page (`ServerProvider` with `groupId`) scoped to the group's children: filters and search (only "Search descriptions too" from the advanced search), edit, selection and bulk tag edit. Selection actions: **Remove from group** (`removeItems`) and **Delete** (the ordinary `main.removeContents` path). Header: title, id, cover, markdown description (sanitized like item notes), tags, and Stats (`groupTagStats` in a modal), Edit (title, description, tags, cover, id), Fix Data, Disband, Delete group. Unknown id: "Group not found".
- **Delete group dialog** (`components/craft/group/DeleteGroupModal.tsx`, shared): asks `groups.planDelete`; without shared items it is a plain confirm; with shared items (also in other groups) they are listed as selectable cards with "Delete only items exclusive to this group" and "Also delete the selected shared items"; shared items not deleted lose only this group id.
- Mutating controls (edit, fix, disband, delete, merge, add to group) are hidden while `tagsAtom` is `null`, like the rest of the Vault ([web app](./web-app.md#extension-handshake-and-read-only-mode)). Stats and the lists stay.

## Limits

- `shortcut:` the card and children computation per call (above).
- `shortcut:` a group created in the item edit modal stays (empty) if the modal is cancelled, and group changes made there apply at once while title/tags save with the item.
- Item pages (`/img/:id`…) and `/sync` do not show an item's groups yet.
- A group delete whose items partly fail keeps the group; items already deleted stay deleted, a retry finishes it.
- Mock pages: `#/mock/groups`, `#/mock/group`, `#/mock/group-empty` ([mock pages](./mock-pages.md)).
