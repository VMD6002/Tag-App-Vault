# Server API

Scope: the Hono server entry (`apps/server/src/index.ts`) and the oRPC routers in `packages/api/src`: procedures, adding an endpoint, runtime settings, startup. Storage is the filesystem plus JSON files (LowDB); there is no SQL database.

## Routers (mounted at `/rpc`)

`packages/api/src/index.ts` exports `router = {fix, main, video, gallery, text, audio, downloads, groups}`, the `router` type, `settingsDB`, `groupsDB`, and `setDownloads` / `downloadsSetSchema` (used by `POST /downloads/set`; `setQueue` is exported too) and `overwriteContent` / `contentSyncSchema` (used by `POST /content/sync`). Files are in `routers/`.

| Router      | Procedures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`      | `getSyncData`, `editSyncItem`, `removeSyncItem`, `bulkEditSyncItems`, `bulkRemoveSyncItems` (pending items in `Sync/`, see [sync pipeline](./sync-pipeline.md#edit-or-remove-before-sync-servicessyncitemts)), `sync`, `setContent` (`{id, title, tags, extraData, groups?}`, [file operations](./file-operations.md#setdoc-maincontent)), `setCover`, `bulkUpdateContentTags`, `removeContents`, `getAllContent` (whole `contentData` record, filtered client-side), `getContent`, `getServerTags`, `getSettings` |
| `gallery`   | `getGalleryData`, `refreshGalleryData`, `removeGalleryContents`, `setCoverGivenFile`, `updateContentTags`, `bulkUpdateContentTags`, `renameGalleryContent`                                                                                                                                                                                                                                                                                                                                                         |
| `text`      | `getTxtData`, `setTxt`, `refreshTxtData`, `removeTxtContents`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `audio`     | `getAudioData`, `removeAudioContents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `video`     | `setCoverGivenFile`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `fix`       | `hardResetTagCount`, `softResetTagCount`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `groups`    | `list`, `get`, `create`, `update`, `addItems`, `removeItems`, `disband`, `planDelete`, `delete`, `fix`, `merge`, `changeId`: [groups below](#groups-router)                                                                                                                                                                                                                                                                                                                                                        |
| `downloads` | `start`, `cancel`, `remove`, `clearFinished`, `getErrorLog`, `clearErrorLog`, `watch` (event stream of snapshots: queue + history + live progress): [server downloads](./server-downloads.md)                                                                                                                                                                                                                                                                                                                      |

- Behaviour: sync [sync pipeline](./sync-pipeline.md); rename, delete and per-type routers [file operations](./file-operations.md); filtering and tags [domain model](./domain-model.md).
- `POST /content/sync` (in `index.ts`, plain route like `/downloads/set`) lets the extension overwrite the title, tags and extraData of existing items. It parses `{ items: { id, title, tags, extraData }[] }` with `contentSyncSchema` (a failed parse throws) and calls `overwriteContent`, which returns `{ updated, missing, failed }`. Rules, reserved tags and rename: [file operations](./file-operations.md#overwritecontent-post-contentsync).
- The download queue is written only by `POST /downloads/set` (in `index.ts`), not by an oRPC procedure. It parses the body `{ items: ContentWebType[], groups: GroupType[] }` with `downloadsSetSchema` (a failed parse throws; the bare-array body is gone) and calls `setDownloads`: it registers the groups the Vault does not know yet at once (the Vault wins: known ids are never overwritten, the incoming `cover` is dropped, tags are counted in `DB/tags.json`), then `setQueue`, which writes `./Download/tmp.json` (and the matching `Download/history.json` records) and returns the written list. While a download run is active it keeps the unfinished items: [server downloads](./server-downloads.md#queue-and-post-downloadsset-during-a-run).

## Groups router

`routers/groups.ts` (thin handlers) over `services/groups.ts` and the pure ops in `@tagapp/utils` ([groups](./groups.md), [domain model](./domain-model.md#groups)). Every mutation runs under `withSyncLock`, applies the op to the live `contentDataDB` / `groupsDB` data, applies the op's `TagDelta` to `tagDB`, then writes only the DBs it touched. If a write fails the DBs are re-read from disk so memory matches the files. There is no per-item file in the library: an item's `groups` live in `DB/contentData.json`. Bad input (unknown group or item id, taken id, merge of fewer than two) is `BAD_REQUEST`, nothing changes.

| Procedure     | Input                                                                     | Output                                                                                   |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `list`        | none                                                                      | `GroupsDB`: every record, empty groups included                                          |
| `get`         | `{ id }`                                                                  | `GroupType`; `NOT_FOUND`                                                                 |
| `create`      | `{ title, id?, extraData?, tags?, cover? }` (`id` defaults to `grp_<10>`) | `{ group, tagDelta }`                                                                    |
| `update`      | `{ id, title?, extraData?, tags?, cover? }` (`cover: ""` clears)          | `{ group, tagDelta }`                                                                    |
| `addItems`    | `{ id, itemIds }`                                                         | `{ group, changed }` (`changed`: the items that gained the id)                           |
| `removeItems` | `{ id, itemIds }`                                                         | `{ group, changed }`                                                                     |
| `disband`     | `{ id }`                                                                  | `{ group, changed, tagDelta }`: record gone, id stripped from every child, items stay    |
| `planDelete`  | `{ id }`                                                                  | `{ exclusive, shared }`: children only in this group / also in other groups (read-only)  |
| `delete`      | `{ id, deleteIds }`                                                       | `{ deleted, detached, group }`: see [file operations](./file-operations.md#group-delete) |
| `fix`         | `{ id? }` (no id: every group)                                            | `{ created, cleared }`                                                                   |
| `merge`       | `{ ids, keepId }`                                                         | `{ group, changed, tagDelta }`                                                           |
| `changeId`    | `{ oldId, newId }` (an existing `newId` merges into it)                   | `{ group, changed, tagDelta }`                                                           |

`delete` is a reserved word, so the file exports it as `export { remove as delete }`. The web client gets groups with `groups.list` (children are computed client-side from `main.getAllContent`, `filterLibrary` runs there). `DB/groups.json` is written once at startup (`apps/server/src/index.ts`) so it always exists; a missing file is an empty record. Tag counts: group tags count in `DB/tags.json`.

## Add an endpoint

1. Export `os.input(zodSchema).handler(...)` from a file in `routers/`. Routers are imported as `import * as main`, so every export becomes a procedure: do not export helpers or schemas, types are fine. A new router file must be added to `router` in `index.ts`.
2. Put non-trivial logic in `services/`.
3. Types reach the web client through `import type { router } from "@tagapp/api"` in `apps/web/src/lib/orpc.ts`; use `orpc.<router>.<proc>`.
4. If mock pages should call it, add a `"router/proc"` handler to `apps/web/src/mock/stubs.ts`: [mock pages](./mock-pages.md).
5. Throw `ORPCError` for client errors.

## Settings and runtime files

- `settings.json` (`db/settings.ts`): `{port: 5001, prefix: "/"}`. No CLI flags and no setter procedure: edit the file and restart. `main.getSettings` returns it.
- LowDB does not merge defaults into an existing file, so a key added to the defaults later is missing from an old `settings.json`.
- `DB/contentData.json` (`db/contentData.ts`), `DB/groups.json` (`db/groups.ts`, `Record<id, GroupType>`) and `DB/tags.json` (`db/tags.ts`; `tagDBValidator` is used only to derive the type, nothing parses with it) are loaded with top-level `await` at import. Layout: [disk layout](./disk-layout.md).
- LowDB handling: mutate `db.data`, then `await db.write()`; write every DB whose data changed: tags with content, `groups.json` with group records. `bun test` sets `NODE_ENV=test`, under which lowdb keeps everything in memory (nothing is written to disk).
- `apps/server/.gitignore` ignores `settings.json` along with `DB/`, `media/`, `Sync/`, `UnSyncable/`, `Download/` and `WebUI/`.

## Startup, port and prefix

- `index.ts` calls `createAppDirs()`, then builds Hono with `logger`, `trimTrailingSlash` and CORS `origin: "*"` (methods POST/GET/PUT/DELETE/OPTIONS), and binds `0.0.0.0` on `settings.port`. It logs local and LAN URLs.
- Route order: `POST /content/sync`, `POST /downloads/set`, `/rpc/*`, `/assets/*` (from `./WebUI`), `/favicon.ico`, static files under the prefix, then the SPA fallback (`index.html`) for the prefix and `<prefix>/*`.
- The prefix is used as written (no normalisation) and only affects the static UI and fallback. The Vite build uses the default `base`, so asset URLs are root-absolute and `/assets/*` and `/favicon.ico` are always at the root, as is `/rpc`.
- The server expects `./WebUI` in its cwd; `bun dev:server` runs it in `apps/server`, the build in `dist`: [deployment](./deployment.md).

## Trust

No authentication, CORS `*`, binds all interfaces: trusted LAN only.
