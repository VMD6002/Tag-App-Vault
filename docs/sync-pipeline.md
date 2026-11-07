# Sync pipeline

Scope: how an item travels from the download queue to the library, and the sync stages in `packages/api/src/services`. Tree and naming: [disk layout](./disk-layout.md). CLI side: [download CLI](./download-cli.md).

## Stages

1. Queue: `POST /downloads/set` validates `ContentWebType[]` and writes `Download/tmp.json` ([server API](./server-api.md)).
2. Download: the CLI moves finished files into `Sync/` and drops the item from the queue.
3. Sync: `main.sync` runs `syncContent`. `main.getSyncData` is the read-only preview.
4. Browse: the web UI queries oRPC; file bytes come from Caddy `/media/...` ([deployment](./deployment.md)).

## getSyncData (`services/getSyncData.ts`, read-only)

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

## syncContent (`services/syncContent.ts`)

- Wrapped in `withSyncLock` (`lib/syncLock.ts`), which queues calls so scans and syncs never overlap; `main.getSyncData` uses it too.
- Per item: move files into `media/<Dir>/` (img/video covers to `.covers/`, captions to `.captions/`; folder items move whole), then prepend the item to `contentDataDB`, `IncrementTagCount`, write both DBs, and delete the `<name>.json` sidecar last (it is the only metadata copy until the DB is written).
- A failure for one item rolls back that item (removes it from memory, decrements tags, moves files back) and the loop continues. Returns all content data.
- Rollback pattern for other file operations: [file operations](./file-operations.md).

## Tests

`packages/api/src/services/sync.test.ts` runs the services against a scratch directory (it `chdir`s there before importing the DB modules, since paths are cwd-relative). Needs Bun >= 1.4.2 for `Bun.Image`. Run: `bun test packages/api` ([development](./development.md)).
