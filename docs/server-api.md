# Server API

Scope: the Hono server entry (`apps/server/src/index.ts`) and the oRPC routers in `packages/api/src`: procedures, adding an endpoint, runtime settings, startup. Storage is the filesystem plus JSON files (LowDB); there is no SQL database.

## Routers (mounted at `/rpc`)

`packages/api/src/index.ts` exports `router = {fix, main, video, gallery, text, audio, downloads}`, the `router` type, `settingsDB` and `setQueue` (used by `POST /downloads/set`). Files are in `routers/`.

| Router      | Procedures                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`      | `getSyncData`, `editSyncItem`, `removeSyncItem` (pending items in `Sync/`, see [sync pipeline](./sync-pipeline.md#edit-or-remove-before-sync-servicessyncitemts)), `sync`, `setContent`, `setCover`, `bulkUpdateContentTags`, `removeContents`, `getAllContent` (whole `contentData` record, filtered client-side), `getContent`, `getServerTags`, `getSettings` |
| `gallery`   | `getGalleryData`, `refreshGalleryData`, `removeGalleryContents`, `setCoverGivenFile`, `updateContentTags`, `renameGalleryContent`                                                                                                                                                                                                                                |
| `text`      | `getTxtData`, `setTxt`, `refreshTxtData`, `removeTxtContents`                                                                                                                                                                                                                                                                                                    |
| `audio`     | `getAudioData`, `removeAudioContents`                                                                                                                                                                                                                                                                                                                            |
| `video`     | `setCoverGivenFile`                                                                                                                                                                                                                                                                                                                                              |
| `fix`       | `hardResetTagCount`, `softResetTagCount`                                                                                                                                                                                                                                                                                                                         |
| `downloads` | `getQueue`, `start`, `watch` (event stream of progress snapshots): [server downloads](./server-downloads.md)                                                                                                                                                                                                                                                     |

- Behaviour: sync [sync pipeline](./sync-pipeline.md); rename, delete and per-type routers [file operations](./file-operations.md); filtering and tags [domain model](./domain-model.md).
- The download queue is written only by `POST /downloads/set` (in `index.ts`), not by an oRPC procedure. It parses the body with `contentWebSchema.array()` (a failed parse throws) and calls `setQueue`, which writes `./Download/tmp.json` and returns the written list. While a download run is active it keeps the unfinished items: [server downloads](./server-downloads.md#queue-and-post-downloadsset-during-a-run).

## Add an endpoint

1. Export `os.input(zodSchema).handler(...)` from a file in `routers/`. Routers are imported as `import * as main`, so every export becomes a procedure: do not export helpers or schemas, types are fine. A new router file must be added to `router` in `index.ts`.
2. Put non-trivial logic in `services/`.
3. Types reach the web client through `import type { router } from "@tagapp/api"` in `apps/web/src/lib/orpc.ts`; use `orpc.<router>.<proc>`.
4. If mock pages should call it, add a `"router/proc"` handler to `apps/web/src/mock/stubs.ts`: [mock pages](./mock-pages.md).
5. Throw `ORPCError` for client errors.

## Settings and runtime files

- `settings.json` (`db/settings.ts`): `{port: 5001, prefix: "/"}`. No CLI flags and no setter procedure: edit the file and restart. `main.getSettings` returns it.
- LowDB does not merge defaults into an existing file, so a key added to the defaults later is missing from an old `settings.json`.
- `DB/contentData.json` (`db/contentData.ts`) and `DB/tags.json` (`db/tags.ts`; `tagDBValidator` is used only to derive the type, nothing parses with it) are loaded with top-level `await` at import. Layout: [disk layout](./disk-layout.md).
- LowDB handling: mutate `db.data`, then `await db.write()`; write both DBs whenever tags or content change.
- `apps/server/.gitignore` ignores `settings.json` along with `DB/`, `media/`, `Sync/`, `UnSyncable/`, `Download/` and `WebUI/`.

## Startup, port and prefix

- `index.ts` calls `createAppDirs()`, then builds Hono with `logger`, `trimTrailingSlash` and CORS `origin: "*"` (methods POST/GET/PUT/DELETE/OPTIONS), and binds `0.0.0.0` on `settings.port`. It logs local and LAN URLs.
- Route order: `POST /downloads/set`, `/rpc/*`, `/assets/*` (from `./WebUI`), `/favicon.ico`, static files under the prefix, then the SPA fallback (`index.html`) for the prefix and `<prefix>/*`.
- The prefix is used as written (no normalisation) and only affects the static UI and fallback. The Vite build uses the default `base`, so asset URLs are root-absolute and `/assets/*` and `/favicon.ico` are always at the root, as is `/rpc`.
- The server expects `./WebUI` in its cwd; `bun dev:server` runs it in `apps/server`, the build in `dist`: [deployment](./deployment.md).

## Trust

No authentication, CORS `*`, binds all interfaces: trusted LAN only.
