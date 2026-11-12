# File operations

Scope: how the server renames, deletes and edits library files and keeps the DB consistent, plus the per-type edit routers. Code: `packages/api/src/services/{setDoc,overwriteContent,deleteData}.ts`, `lib/fsBaseNameFunctions.ts`, `routers/{gallery,audio,text,video}.ts`.

## Conventions (keep them when editing)

- Multi-file operations are transactional by convention: track completed steps and roll back in reverse on error (`syncContent`, `setDoc`, `deleteData`).
- Deletes are two-phase: rename to `*.del`, then remove; on failure rename back. The DB is changed only after the fs step succeeds.
- Update tag counts whenever an item's tags change or an item is removed: [domain model](./domain-model.md#tags).
- Paths are cwd-relative (`./media`, `./DB`, `./Sync`); see [server API](./server-api.md).
- Prefer Bun APIs (`Bun.file`, `Bun.write`); `node:fs` only for what Bun lacks: directories, `rename`, recursive or forced `rm`, sync calls.

## Helpers (`lib/fsBaseNameFunctions.ts`)

- `hasBasename`, `renameByBasename`, `rmByBasename` match a file by name without its extension, so cover and media files with unknown extensions are addressed by `<title>.<id>` alone. `renameByBasename` keeps the original extension. Missing target throws `ORPCError("NOT_FOUND")`.
- `pathExists` also works for folders (`Bun.file().exists()` reports folders as missing).

## setDoc (`main.setContent`)

- 404 if the id is unknown. If the title changed: img/video rename media, `.covers` cover (when present) and `.captions` caption (video with `meta:caption`) one by one with rollback, throwing `INTERNAL_SERVER_ERROR` on failure; gallery/audio/txt rename the folder (no rollback needed, single rename).
- Tag diff goes through `DecrementTagCount` / `IncrementTagCount`. Then merges the input over the stored item, writes both DBs.
- Input is `id`, `title`, `tags`, `extraData` and optional `groups` (the item's full group list; `[]` clears it, absent keeps it). Unknown group ids are rejected with `BAD_REQUEST` before any file moves. Joined and left groups go through `addGroupItems` / `removeGroupItems` from `@tagapp/utils` (group `lastUpdated`, set-once cover rule, empty `groups` key dropped) after the tag diff, and `DB/groups.json` is written (after the item and tag DBs) only when membership changed. `lastUpdated` of the item changes only when its groups do. The router runs the call under `withSyncLock`, so it queues behind a running scan or sync.

## overwriteContent (`POST /content/sync`)

`services/overwriteContent.ts`, for the extension's "Sync with server" button ([sister project](./sister-project.md#runtime-connection)). Body `contentSyncSchema`: `{ items: { id, title, tags, extraData }[] }`. Under one `withSyncLock` it walks the items and, per item:

- id not in the library: reported in `missing`, nothing created.
- Title goes through `safeTitle` (`@tagapp/utils/download`, the CLI's file-name rule: `\ / : * ? " < > | %` and control characters become `_`), so a re-sent title that was already sanitised on disk is unchanged. An empty result fails the item.
- Tags: the incoming list, plus every reserved tag (`RESERVED_TAGS`: `meta:*`, `view:*`) the item already has. Those are Vault-owned settings (display and pipeline), and the extension does not know the Vault-only ones, so sync never strips them; consequently it cannot remove them either (remove them in the Vault UI). Other reserved tags can be added from the extension. `meta:caption` is derived from the caption file, so it is never taken from the incoming list: kept if the item has it, dropped otherwise.
- Nothing differs (title, extraData, tag set): skipped, no rename, no write, not listed anywhere.
- Otherwise it calls `setDoc` (so rename with rollback, tag-count deltas and both DB writes are the ones above; `groups` is left alone). An exception is caught per item and returned in `failed: {id, error}[]` while the rest go on; the item keeps its old data, because `setDoc` renames before it touches counts. Result: `{ updated: string[], missing: string[], failed: {id, error}[] }`.
- `setDoc` writes the DBs per updated item, so a large sync is N writes of `contentData.json` (fine for hundreds of items).

## deleteData (`main.removeContents`)

- Rejects the whole call with `BAD_REQUEST` if any id is unknown. Then per item: rename cover (if present), media and caption to `.del`, remove them, `DecrementTagCount`, delete from memory. A failure rolls back that item and continues with the next.
- Both DBs are written once at the end. Returns the ids that were deleted.

## Group delete

`groups.delete` (`services/groups.ts`, under `withSyncLock`) deletes through `deleteData`: it plans with `planDeleteGroup` (exclusive children plus the chosen shared `deleteIds`), calls `deleteData` on them (two-phase, per-item rollback, its own tag counts), and only if every one was deleted drops the group record, strips the id from the shared children that stay and decrements the group's tags, then writes the three DBs. If any item failed it throws `INTERNAL_SERVER_ERROR` and keeps the group (items already deleted stay deleted; retry). Other group operations only edit `DB/contentData.json` / `DB/groups.json` (no files move). Deleting or renaming a single item needs no group change: children are computed from the items' `groups`, and `setDoc` keeps `groups` (it merges over the stored item).

## Per-type routers

- gallery: `getGalleryData` (cached `.gallery-data.json`, else generate), `refreshGalleryData`, `removeGalleryContents`, `setCoverGivenFile`, `updateContentTags` (per-file tags in `.tags.json`), `bulkUpdateContentTags` (`{ name, id, contents, add, remove }`: per selected file, tags = current minus `remove` plus `add`, `add` wins; rejects the whole call with `NOT_FOUND` if a file is not in the gallery data or not on disk, `NOT_ACCEPTABLE` on an empty selection; one `.tags.json` write then one `.gallery-data.json` write, and `.tags.json` is restored if the second fails; returns the full file list; gallery file tags do not count toward `DB/tags.json`), `renameGalleryContent` (keeps extension, rejects `/ \ ? % * : | " < >` and name conflicts, renames the cover and `.tags.json` key too). Files: [disk layout](./disk-layout.md#files-the-server-generates).
- audio: `getAudioData` and `removeAudioContents` list the folder each time; a track's cover is the first `.audio-covers` file starting with `cover.<track name without extension>` (`path.parse`, any extension).
- text: `getTxtData`, `setTxt` (writes any `txtName` into the folder), `refreshTxtData`, `removeTxtContents`.
- video: `setCoverGivenFile` replaces the `.covers` cover, using the upload's MIME subtype as extension. Gallery's `setCoverGivenFile` does the same in `.gallery-covers`.
- These routers take `name` + `id` and build `./media/<Dir>/<name>.<id>` from them, so callers pass the current title.
