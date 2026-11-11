# Sync pipeline

Scope: how an item travels from the download queue to the library, and the sync stages in `packages/api/src/services`. Tree and naming: [disk layout](./disk-layout.md). Download side: [server downloads](./server-downloads.md), [download CLI](./download-cli.md).

## Stages

1. Queue: `POST /downloads/set` validates `{ items: ContentWebType[], groups: GroupType[] }`, registers the unknown groups and writes `Download/tmp.json` ([server API](./server-api.md)). Items keep their `groups` ids through the sidecar into the library.
2. Download, two ways:
   - Server (primary): `downloads.start` downloads and moves each finished item into its own staging folder `Download/done/<id>/`, then runs `syncContent` on that folder and drops the item from the queue. No `Sync/`, no manual sync: [server downloads](./server-downloads.md).
   - CLI: moves finished files into `Sync/` and drops the item from the queue; then step 3.
3. Sync: `main.sync` runs `syncContent`. `main.getSyncData` is the read-only preview.
4. Browse: the web UI queries oRPC; file bytes come from Caddy `/media/...` ([deployment](./deployment.md)).

## getSyncData (`services/getSyncData.ts`, read-only)

The scan, prepare and sync services take the folder to work on (`dir`, default `SYNC` = `./Sync`); the server download pipeline passes a staging folder. Everything below says `Sync/` for the default. `UnSyncable/` is always `./UnSyncable`.

- Scans `Sync/`. Pairs media with `cover.<name>.<ext>` (first cover wins, duplicates warn) and, for videos, `caption.<name>.vtt`.
- Folder items are detected by suffix `.gallery`, `.audio`, `.txt` (`folderThumbs`).
- Metadata comes from `tdata.*.json` bundles (arrays of `ContentWebType`), else `<name>.json`, validated with `ContentJsonSchema`; invalid or unreadable JSON is logged and the item is skipped: its files and its JSON stay in `Sync/` (like an existing id), so fixing the JSON is enough. With no JSON it builds metadata in memory: `id` `gen_<nanoid10>`, `extraData: "Generated Data"`, file mtime as `added` and `lastUpdated`, no tags.
- Tags are trimmed and de-blanked; `meta:caption` is set exactly when a caption file exists.
- An id already in `contentDataDB`, or repeated earlier in the scan, is logged and left in `Sync/`.
- Returns `{contents, unsyncable, orphanJsons}`. `unsyncable` is every file or folder not consumed by an item (including files still being copied in: see below); orphan JSON sidecars stay where they are.

## prepareSync (`services/prepareSync.ts`, the writes)

- Splits each `tdata.*.json` into per-item `<title>.<id>.json`, then calls `getSyncData`.
- Generates missing image covers (`Bun.Image`, fit inside 800x800, webp quality 80, saved as `cover.<name>.webp`).
- Renames files and sidecar to `<title>.<id>` when the current name differs (generated ids, bundles); a failure moves that item's files to the unsyncable list.
- Moves everything unsyncable to `UnSyncable/`. Returns the items ready to sync.
- Known limit: every sync moves all leftovers, so a file that is still being copied into `Sync/` is moved away mid-copy. Not fixed: it needs a decision (for example skip files modified in the last N seconds, or only move files that match no item for two consecutive scans).

## Edit or remove before sync (`services/syncItem.ts`)

Behind the web `/sync` preview ([web app](./web-app.md)). `main.editSyncItem` and `main.removeSyncItem` take the item's current disk `name` (as in `getSyncData().contents[id].name`) and `type`; the service runs under `withSyncLock`, calls `splitTData` and re-scans, and matches `name` + `type` against the scan (`NOT_FOUND` otherwise), so a client string never becomes a path. The router also rejects names containing `/` or `\`.

- Splitting bundles first means an item from a `tdata.*.json` has its own `<name>.json` sidecar, so the edit wins over the bundle (which is gone). The split is what the next sync does anyway; other bundle items become plain sidecars.
- Edit overwrites `<name>.json` with the scanned `id`, `added`, `lastUpdated` (and `cover`) plus the new title (trimmed, `sanitizeStringForFileName`; blank is `BAD_REQUEST`), tags and `extraData`. For an item without JSON this pins its generated `gen_` id. Files are not renamed here: prepareSync does that at sync. Tags are normalised by the next scan as always (trim, `meta:caption` mirrors the caption file).
- Remove is non-destructive: it moves `filesOf(...)` and the sidecar (if any) into `UnSyncable/`, rolling back in reverse if a move fails. Unlike prepareSync (whose `rename` silently replaces), it refuses with `CONFLICT` when `UnSyncable/` already holds a file of that name. A bundled item has already been split, so no bundle entry is left behind.

## syncContent (`services/syncContent.ts`)

- Wrapped in `withSyncLock` (`lib/syncLock.ts`, built with `createLock`, which the download queue file also uses), which queues calls so scans and syncs never overlap; `main.getSyncData` uses it too.
- Per item: move files into `media/<Dir>/` (img/video covers to `.covers/`, captions to `.captions/`; folder items move whole), then prepend the item to `contentDataDB`, `IncrementTagCount`, write both DBs, and delete the `<name>.json` sidecar last (it is the only metadata copy until the DB is written).
- Every group id of the item that has no record in `DB/groups.json` gets one (`title = id`, no tags, no cover; `services/groups.ts`, `groupsDB` is written with the other two) under the same lock; existing records are untouched. A failure for one item rolls back that item (removes it from memory, decrements tags, drops the records it created, moves files back) and the loop continues. Returns all content data.
- Rollback pattern for other file operations: [file operations](./file-operations.md).

## Tests

`packages/api/src/services/groups.test.ts` covers the group router and services, group registration at `POST /downloads/set` and the sync auto-create. `packages/api/src/services/sync.test.ts` runs the services against a scratch directory (it `chdir`s there before importing the DB modules, since paths are cwd-relative). Needs Bun >= 1.4.2 for `Bun.Image`. Run: `bun test packages/api` ([development](./development.md)).
