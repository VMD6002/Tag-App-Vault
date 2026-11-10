# Domain model

Scope: content types, item identity, the item and queue schemas, tags and their counts, `meta:*` tags, and filtering. Shared code lives in `packages/utils/src` (`constants.ts`, `types/*.ts`, `filterData.ts`).

## Content types

- `CType` (`CtypeSchema` in `types/server.ts`): `img`, `video`, `gallery`, `audio`, `txt`.
- `contentTypes` and `CTypeDir` (`constants.ts`) map type to media dir: `img` Images, `video` Videos, `gallery` Galleries, `audio` Audios, `txt` Texts. Disk shapes: [disk layout](./disk-layout.md).
- Type is decided by file extension on sync, see [disk layout](./disk-layout.md#recognised-extensions).

## Adding a content type

Touch each place that switches on type: `contentTypes` and `CTypeDir` (`constants.ts`), `CtypeSchema` (`types/server.ts`), extensions in `getCtype.ts`, `getSyncData` (`folderThumbs` or the media tasks), the `syncContent`, `deleteData` and `setDoc` branches, `createAppDirs`, the Caddyfile ([deployment](./deployment.md)), and in the web app a page plus the route table and `DOC_ROUTE` in `AppLayout.tsx` ([web app](./web-app.md)). Then the matching mock page and stubs ([mock pages](./mock-pages.md)).

## Identity

- An item has `id` (string) and `title`. Generated ids look like `gen_<nanoid10>` ([sync pipeline](./sync-pipeline.md)); ids from the downloader are whatever the queue item carries.
- Everything on disk is named `<title>.<id>`. Renaming a title renames files; the `id` never changes ([file operations](./file-operations.md)).
- Title safety: the CLI replaces `\ / : * ? " < > | %` and control characters with `_` (`fileBase`); the web edit flows run `sanitizeStringForFileName` (filenamify, replacement `-`) before `setContent`. The server itself does not sanitize titles on sync or in `setDoc`.

## Schemas

| Schema                                      | File              | Fields                                                                                                                            |
| ------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ContentJsonSchema`                         | `types/shared.ts` | `id`, `title`, `tags[]`, `extraData`, `cover?`, `added`, `lastUpdated` (unix seconds)                                             |
| `contentServerSchema` / `ContentServerType` | `types/server.ts` | `ContentJsonSchema` plus `type` (`CType`). Stored in `DB/contentData.json`                                                        |
| `contentWebSchema` / `ContentWebType`       | `types/web.ts`    | `ContentJsonSchema` plus `url`, `scraper`, `download?` (`{type, flags?: {label, value}}`), `contentUrl?`. The download queue item |

- Zod validates every boundary. The web app's Generate JSON page validates with the shared `ContentJsonSchema` too.

## Tags

- Tags are free strings. `DB/tags.json` is `Record<tag, count>` and must match the tags of the items in `DB/contentData.json`.
- Change counts through `IncrementTagCount` / `DecrementTagCount` (`packages/api/src/db/tags.ts`). Decrement deletes a tag whose count drops below 1 and ignores unknown tags. Both mutate memory only: call `tagDB.write()` afterwards.
- Always update counts when an item's tags change or an item is removed (`setDoc`, `deleteData`, `syncContent` and `main.bulkUpdateContentTags` do, via the helpers). Bulk update counts only real changes: a tag already on the item is not counted again, removing a tag the item lacks changes nothing, and a tag in both `added` and `removed` ends up on the item with its count unchanged. An unknown id rejects the whole call before anything changes.
- Repair: `fix.hardResetTagCount` rebuilds all counts from the items; `fix.softResetTagCount` deletes tags whose count is 0. Both write `DB/tags.json`.

## Meta tags

| Tag                    | Effect                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta:caption`         | A `.vtt` caption exists. `getSyncData` re-derives it on every sync from the caption file; `setDoc` and `deleteData` use it to move or remove the caption. The video page shows captions only with it |
| `meta:autoplay`        | Gallery page turns autoplay on                                                                                                                                                                       |
| `meta:yt-cookie`       | CLI passes `./cookies/<Site>.txt` to yt-dlp; needs a `Site:<name>` tag: [download CLI](./download-cli.md)                                                                                            |
| `meta:different-cover` | CLI downloads `item.cover` itself instead of yt-dlp's thumbnail: [download CLI](./download-cli.md)                                                                                                   |

To add one: handle it where it acts (CLI `createFlags.ts`, sync, or web) and add a row here.

## Filtering

`filterData` (`filterData.ts`) runs in the browser, not on the server: the web app loads the whole library with `main.getAllContent` and filters it in memory ([web app](./web-app.md#state)). `FilterQuerySchema` is its input.

- `any`: item has at least one of these tags. `all`: item has every one. `none`: item has none of them (`ArrayHasAnyModified`, `ArrayHasAll` in `ArrayHelperFunctions.ts`).
- `any` and `none` accept wildcards: `*` matches any item with at least one tag, `Parent:*` matches any tag starting with `Parent:`. `all` is exact.
- `types`: empty means all types. `search`: Fuse.js fuzzy match on `title` (threshold 0.5), applied after the tag and type filters.
- Result is always sorted by `added`: newest first when `orderByLatest`, else oldest first.
