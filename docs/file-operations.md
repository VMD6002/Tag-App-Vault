# File operations

Scope: how the server renames, deletes and edits library files and keeps the DB consistent, plus the per-type edit routers. Code: `packages/api/src/services/{setDoc,deleteData}.ts`, `lib/fsBaseNameFunctions.ts`, `routers/{gallery,audio,text,video}.ts`.

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
- Input is only `id`, `title`, `tags`, `extraData`; `lastUpdated` is not touched.

## deleteData (`main.removeContents`)

- Rejects the whole call with `BAD_REQUEST` if any id is unknown. Then per item: rename cover (if present), media and caption to `.del`, remove them, `DecrementTagCount`, delete from memory. A failure rolls back that item and continues with the next.
- Both DBs are written once at the end. Returns the ids that were deleted.

## Per-type routers

- gallery: `getGalleryData` (cached `.gallery-data.json`, else generate), `refreshGalleryData`, `removeGalleryContents`, `setCoverGivenFile`, `updateContentTags` (per-file tags in `.tags.json`), `renameGalleryContent` (keeps extension, rejects `/ \ ? % * : | " < >` and name conflicts, renames the cover and `.tags.json` key too). Files: [disk layout](./disk-layout.md#files-the-server-generates).
- audio: `getAudioData` and `removeAudioContents` list the folder each time; a track's cover is the first `.audio-covers` file starting with `cover.<track name without extension>` (`path.parse`, any extension).
- text: `getTxtData`, `setTxt` (writes any `txtName` into the folder), `refreshTxtData`, `removeTxtContents`.
- video: `setCoverGivenFile` replaces the `.covers` cover, using the upload's MIME subtype as extension. Gallery's `setCoverGivenFile` does the same in `.gallery-covers`.
- These routers take `name` + `id` and build `./media/<Dir>/<name>.<id>` from them, so callers pass the current title.
