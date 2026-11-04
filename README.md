# TagAppVault

Self-hosted, tag-based media library (server-side port of TagApp 5.0). Content is downloaded into a queue, synced into a library on disk, then browsed/tagged/filtered in a web UI. No auth; trusted-LAN use. **Storage is the filesystem plus JSON files (LowDB). There is no SQL database.**

> For LLM sessions: this file is the project reference. Code is the source of truth where it disagrees with `Notes/TagApp Server Reference.md` (see [Gotchas](#gotchas)).

## Stack

Bun workspaces · Hono + oRPC (`/rpc`) · Vite + React + wouter (hash router) · LowDB (JSON) · Zod · Jotai + Constate + TanStack Query · Tailwind + shadcn/ui · Caddy (media + proxy) · yt-dlp via `yt-dlp-wrap-plus`, Ink TUI, p-queue (CLI) · Biome (lint/format).

## Repo map

| Path             | Package          | Role                                                                                                                                                                         |
| ---------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`    | `tag-app-server` | Hono entry (`src/index.ts`): mounts oRPC at `/rpc`, `POST /downloads/set`, serves built UI from `./WebUI` under a prefix. Creates runtime dirs (`src/lib/createAppDirs.ts`). |
| `apps/web`       | `tag-app-web`    | React SPA. Builds into `apps/server/dist/WebUI`. oRPC client: `src/lib/orpc.ts`. Routes: `src/App.tsx` + `src/routes/**`.                                                    |
| `apps/cli`       | `tag-app-cli`    | Download worker (`src/index.tsx`). Reads queue `tmp.json`, runs yt-dlp/curl, drops results into `Sync/`.                                                                     |
| `apps/Caddyfile` | -                | `:5000`. Serves `/media/*` from disk (cover extension fallbacks, no-cache on `.covers`), proxies everything else to `localhost:5001`.                                        |
| `packages/api`   | `@tagapp/api`    | oRPC `router` (`src/index.ts`), `routers/*` (thin handlers), `services/*` (sync/delete/update logic), `db/*` (LowDB stores), `lib/*` (fs/type helpers).                      |
| `packages/utils` | `@tagapp/utils`  | Shared Zod schemas + types (`types/{shared,server,web}.ts`), `CTypeDir`, `contentTypes`, `filterData` (Fuse.js title search + tag filters), array/string helpers.            |
| `Notes/`         | -                | Human-oriented folder layout reference.                                                                                                                                      |

Imports: `@tagapp/api` exports `router` (type + value) and `settingsDB`; `@tagapp/utils` and `@tagapp/utils/types`. Web alias `@/` → `apps/web/src`. In `packages/api` use `.js` suffixes on relative imports.

## Concepts

- **Content types** (`CType`): `img`, `video`, `gallery`, `audio`, `txt`. `CTypeDir` maps type → media dir (`Images`, `Videos`, `Galleries`, `Audios`, `Texts`).
- **Item identity**: `id` (string; generated ids look like `gen_<nanoid10>`) and `title`. **Everything on disk is named `<title>.<id>`**. Renaming a title renames files; the id never changes.
- **Content JSON** (`ContentJsonSchema`): `id, title, tags[], extraData, cover?, added, lastUpdated` (unix seconds). Server adds `type` (`ContentServerType`). Download queue items (`ContentWebType`) add `url, scraper, download?{type, flags?{label,value}}, contentUrl?`.
- **Tags**: free strings. `DB/tags.json` stores usage counts and must stay in sync with items (use `IncrementTagCount`/`DecrementTagCount`; they delete a tag at count < 1). Repair via `fix.hardResetTagCount` / `softResetTagCount`.
- **Meta tags** (`meta:*`) drive behaviour:

| Tag                    | Effect                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| `meta:caption`         | A `.vtt` caption exists. Auto-maintained on sync to mirror file presence. |
| `meta:autoplay`        | Gallery autoplay.                                                         |
| `meta:yt-cookie`       | CLI passes `./cookies/<Site>.txt`; requires a `Site:<name>` tag.          |
| `meta:different-cover` | CLI downloads `item.cover` URL itself instead of yt-dlp's thumbnail.      |

## Pipeline

1. **Queue**: UI/extension → `POST /downloads/set` (or `download.set`) validates `ContentWebType[]` and writes `Download/tmp.json`.
2. **Download** (`apps/cli`): 1 concurrent per `scraper`, 3 total. Writes to `./tmp`, then moves `*.<id>.*` files and `<title>.<id>.json` to `../Sync`, removes the item from the queue. Errors → `error.log`.
3. **Sync** (`services/getSyncData.ts`, `services/prepareSync.ts`, `services/syncContent.ts`, serialized by `lib/syncLock.ts`):
   - `getSyncData` is a read-only scan of `Sync/`: pairs media with `cover.<name>.<ext>`; detects folder items by suffix (`.gallery`, `.audio`, `.txt`); validates JSON with Zod; builds metadata in memory if there is no JSON (`extraData: "Generated Data"`, mtime as timestamps); normalizes tags; leaves ids that already exist in `Sync/`; reports orphan JSON.
   - `prepareSync` does the writes: splits `tdata.*.json` into per-item JSON; generates missing image covers (`Bun.Image`, webp); writes sidecars and renames files to embed the id; moves leftovers to `UnSyncable/`.
   - `syncContent` moves each item into `media/<Dir>/` (covers → `.covers/`, captions → `.captions/`), writes `DB/contentData.json` and `DB/tags.json`, then deletes the sidecar. Per-item failure rolls back moved files.
4. **Browse**: UI queries oRPC; file bytes come from Caddy `/media/...`.

## Disk layout (runtime, relative to server cwd)

```
settings.json              {port, prefix}
DB/contentData.json        Record<id, ContentServerType>
DB/tags.json               Record<tag, count>
Download/tmp.json          pending download queue
Sync/  UnSyncable/         staging in / rejected
media/
  Images/   .covers/cover.<title>.<id>.<ext>   <title>.<id>.<ext>
  Videos/   .covers/ .captions/caption.<title>.<id>.vtt   <title>.<id>.<ext>
  Galleries/<title>.<id>/  .gallery-covers/  <files>
  Audios/<title>.<id>/     .audio-covers/    <files>
  Texts/<title>.<id>/      .media/           <name>.md
```

Sync-folder form: `<title>.<id>.gallery|audio|txt/` (same inner layout). Gallery/audio use `.gallery-covers`/`.audio-covers` instead of `.covers` to avoid extra Caddy rules. Recognised extensions (`lib/getCtype.ts`): img `jxl jpg jpeg png webp svg avif apng gif`; video `mp4 webm avi`; audio `mp3 wav`; txt `txt md`.

## API (oRPC, mounted at `/rpc`, `packages/api/src/routers`)

- `main`: `getSyncData`, `sync`, `setContent` (title/tags/extraData; renames files + adjusts tag counts), `setCover`, `bulkUpdateContentTags`, `removeContents`, `getFilteredData` (`FilterQuerySchema`: any/all/none tags, search, types, orderByLatest), `getContent`, `getServerTags`, `getSettings`
- `gallery`: `getGalleryData`, `refreshGalleryData`, `removeGalleryContents`, `setCoverGivenFile`, `updateContentTags`, `renameGalleryContent`
- `text`: `getTxtData`, `setTxt`, `refreshTxtData`, `removeTxtContents`
- `audio`: `getAudioData`, `removeAudioContents`
- `video`: `setCoverGivenFile` · `download`: `set` · `fix`: `hardResetTagCount`, `softResetTagCount`

Add an endpoint: export `os.input(zod).handler(...)` from a router file; it is auto-typed on the web client (`orpc.<router>.<proc>`). Put non-trivial logic in `services/`.

## Web routes (`apps/web/src/routes`)

`/` library + filters · `/tags` · `/generateContentJson` · `/img/:id` · `/video/:id` · `/gallery/:id` · `/txt/:id` · `/audio/:id` (the `:id` routes share `DocProvider` context). Page-level code lives in `routes/<type>/`, shared pieces in `routes/components/`, generic UI in `components/` (`ui/` = shadcn, `craft/` = custom modals/confirm). Receives tags from a browser extension via `window.postMessage` (`TAG_APP_INJECT_TAGS` → ack `TAG_APP_TAGS_RECEIVED`).

## Where to change X

| Task                    | Look at                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New content type        | `contentTypes`/`CTypeDir` (utils), `CtypeSchema`, `getCtype`, `getSyncData`/`syncContent`/`deleteData`/`setDoc` switch statements, `createAppDirs`, Caddyfile, web route + `App.tsx` |
| New meta tag            | Document here; handle in CLI (`createFlags.ts`) or sync/web as needed                                                                                                                |
| Sync behaviour          | `services/getSyncData.ts`, `services/prepareSync.ts`, `services/syncContent.ts`                                                                                                      |
| Delete/rename behaviour | `services/deleteData.ts`, `services/setDoc.ts`, `lib/fsBaseNameFunctions.ts`                                                                                                         |
| Filtering/search        | `packages/utils/src/filterData.ts`                                                                                                                                                   |
| Download flags / yt-dlp | `apps/cli/src/lib/createFlags.ts`, `downloadContent.ts`                                                                                                                              |
| Server prefix/port      | `apps/server/src/index.ts`, `packages/api/src/db/settings.ts`                                                                                                                        |

## Commands

```bash
bun install
bun dev:server      # cd apps/server && bun --watch src/index.ts (cwd = runtime root)
bun dev:web         # Vite
bun type:check      # all workspaces
bun check           # Biome lint+format (check:fix / lint:fix / format:fix to apply)
bun test packages/api  # sync tests (scratch dir, needs Bun >= 1.4.2 for Bun.Image)
bun build:serverFull  # → apps/server/dist: index.js, WebUI/, Download/index.js (CLI), Caddyfile
```

Server port and UI prefix come only from `settings.json` (defaults `5001` and `/`); there are no CLI flags, so edit the file and restart. Run server on `:5001` behind Caddy on `:5000`. CLI runs from `dist/Download` with `bun index.js` (its `../Sync` and `tmp.json` resolve relative to that).

## Conventions

- Biome: 2-space indent, double quotes; fix lint before committing. TypeScript, ESM, Zod for all boundary validation.
- **File operations are transactional by convention**: multi-file moves track completed steps and roll back on error (see `syncContent`, `setDoc`, `deleteData`). Keep this when editing them.
- **Deletes are two-phase**: rename to `*.del`, then remove; rollback on failure. DB is written only after fs success.
- Always update tag counts when changing an item's tags or removing an item.
- Server fs paths are cwd-relative (`./media`, `./DB`, `./Sync`).
- Server and CLI run on Bun only. Prefer Bun APIs (`Bun.file`, `Bun.write`); use `node:fs` only for what Bun lacks: directories, `rename`, recursive or forced `rm`, and sync calls.

## Gotchas

- Per-app READMEs in `apps/*` are untouched templates; ignore them.
- CORS is `*` everywhere; there is no authentication.
