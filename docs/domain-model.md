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

| Schema                                      | File              | Fields                                                                                                                                                                                     |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ContentJsonSchema`                         | `types/shared.ts` | `id`, `title`, `tags[]`, `extraData`, `cover?`, `groups?` (group ids), `added`, `lastUpdated` (unix seconds)                                                                               |
| `contentServerSchema` / `ContentServerType` | `types/server.ts` | `ContentJsonSchema` plus `type` (`CType`). Stored in `DB/contentData.json`                                                                                                                 |
| `contentWebSchema` / `ContentWebType`       | `types/web.ts`    | `ContentJsonSchema` plus `url`, `scraper`, `download?` (`{type, flags?: {label, value}}`), `contentUrl?`. The download queue item                                                          |
| `GroupSchema` / `GroupType`                 | `types/group.ts`  | `id` (`grp_<nanoid10>`), `title`, `extraData` (markdown), `tags[]`, `cover?` (plain URL), `added`, `lastUpdated` (seconds). `GroupsDB = Record<id, GroupType>`, stored in `DB/groups.json` |

- Zod validates every boundary. The web app's Generate JSON page validates with the shared `ContentJsonSchema` too.

## Tags

- Tags are free strings. `DB/tags.json` is `Record<tag, count>` and must match the tags of the items in `DB/contentData.json`.
- Change counts through `IncrementTagCount` / `DecrementTagCount` (`packages/api/src/db/tags.ts`). Decrement deletes a tag whose count drops below 1 and ignores unknown tags. Both mutate memory only: call `tagDB.write()` afterwards.
- Always update counts when an item's tags change or an item is removed (`setDoc`, `deleteData`, `syncContent` and `main.bulkUpdateContentTags` do, via the helpers). Bulk update counts only real changes: a tag already on the item is not counted again, removing a tag the item lacks changes nothing, and a tag in both `added` and `removed` ends up on the item with its count unchanged. An unknown id rejects the whole call before anything changes.
- Repair: `fix.hardResetTagCount` rebuilds all counts from the items; `fix.softResetTagCount` deletes tags whose count is 0. Both write `DB/tags.json`.

## Groups

A group is an extra index over items (same topic or author); grouped items leave the main library and show as one card. Groups never nest. The item is the source of truth (`groups` ids on the item); a group record is metadata. Pure operations (`create`, `update`, `addItems`, `removeItems`, `disband`, `delete`, `fix`, `merge`, `changeId`), the children and tag-stat helpers, `newGroupId`, `setInitialGroupCover` and `groupSortKey` live in `packages/utils/src/groups.ts`; each op mutates the given state and returns the group-tag delta (`TagDelta`, applied with `applyTagDelta`) so `DB/tags.json` stays in sync: group tags count like item tags. Item deletion is the caller's job (`deleteGroup` only returns the plan: exclusive items plus the chosen shared ones to delete, the other shared ones just lose the id). Fix Data recreates missing records (`title = id`, no cover) and clears an empty-string cover, nothing else. Children and tag stats are computed on the fly. The group `cover` is set once, when the first items join a group with no children and an empty cover (`addItems`, sync): see [groups](./groups.md#cover); `getCoverUrl` (`packages/utils/src/coverUrl.ts`) is the library cover URL of an item, shared by server and web. Behaviour, endpoints and UI: [groups](./groups.md).

## Meta tags

`meta:` tags change pipeline or data behaviour (CLI, sync, server). Display preferences are not meta tags: they use the `view:` parent ([View tags](#view-tags)).

| Tag                    | Effect                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta:caption`         | A `.vtt` caption exists. `getSyncData` re-derives it on every sync from the caption file; `setDoc` and `deleteData` use it to move or remove the caption. The video page shows captions only with it |
| `meta:yt-cookie`       | CLI passes `./cookies/<Site>.txt` to yt-dlp; needs a `Site:<name>` tag: [download CLI](./download-cli.md)                                                                                            |
| `meta:different-cover` | CLI downloads `item.cover` itself instead of yt-dlp's thumbnail: [download CLI](./download-cli.md)                                                                                                   |

To add one: add its constant to `reservedTags.ts` and to `RESERVED_TAGS`, handle it where it acts (CLI `createFlags.ts` or sync, using the constant), and add a row here and in the reference note ([Reserved tags](#reserved-tags)). Display options go under `view:` instead.

## View tags

`view:` is the parent for per-item display preferences. Only the web app reads them (`parseViewTags` in `packages/utils/src/viewTags.ts`); the CLI, server and sync ignore them. Today they apply to the gallery page. Tags are exact, case-sensitive strings; unknown `view:*` tags are ignored.

| Tag                                                       | Effect on the gallery page                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `view:sort-a-z` / `view:sort-z-a`                         | Sort by name ascending / descending (`name-asc` / `name-desc`)                                                                                   |
| `view:sort-newest` / `view:sort-oldest`                   | Sort by created date, newest / oldest first                                                                                                      |
| `view:sort-modified-newest` / `view:sort-modified-oldest` | Sort by modified date, newest / oldest first                                                                                                     |
| `view:list`                                               | Single-column layout                                                                                                                             |
| `view:grid-auto`                                          | Responsive grid (column count follows the screen)                                                                                                |
| `view:grid-2` / `view:grid-3` / `view:grid-4`             | Fixed grid of 2 / 3 / 4 columns                                                                                                                  |
| `view:autoplay` / `view:no-autoplay`                      | Videos autoplay in the gallery / do not                                                                                                          |
| `view:width-<10..100>`                                    | Single-column width in percent (list layout only), e.g. `view:width-60`                                                                          |
| `view:hide-in-library`                                    | Not a display option (`VIEW_HIDE_IN_LIBRARY_TAG`): the item is left out of the main library, see [Library filter](#library-filter-filterlibrary) |
| `view:in-library`                                         | Not a display option (`VIEW_IN_LIBRARY_TAG`, not in `VIEW_TAGS`): a grouped item with it still shows in the library, see [Groups](#groups)       |

- Precedence per option: the user's own choice on that gallery (`localStorage`) beats the `view:` tag, which beats the Settings default. A tag never writes the user's choice, so removing it takes effect on the next load; "Reset" in the gallery options drops the own choices and returns to the tag values.
- Conflicts: if an item has several tags for one option (say `view:list` and `view:grid-2`), the first in the item's tag order wins. Out-of-range widths (`view:width-5`, `view:width-101`) are ignored.

To add one: add it to `VIEW_TAGS` in `viewTags.ts` (and a test in `viewTags.test.ts`; it joins the reserved list automatically), wire the new option into the gallery atoms ([web app](./web-app.md#state)), and add a row here.

## Reserved tags

`RESERVED_TAGS` (`packages/utils/src/reservedTags.ts`) is the one fixed list of tags the system reads: the `meta:` constants (`CAPTION_TAG`, `YT_COOKIE_TAG`, `DIFFERENT_COVER_TAG`, which the sync and CLI code import) plus every key of `VIEW_TAGS` plus `view:in-library` (`VIEW_IN_LIBRARY_TAG`) plus `view:hide-in-library` (`VIEW_HIDE_IN_LIBRARY_TAG`) plus `view:width-10` … `view:width-100` in steps of 10 (the parser still accepts any 10..100). `withReservedTags(tags)` returns `tags` followed by the reserved tags it lacks, no duplicates. The web app applies it to the extension's tags so the pickers always offer them ([web app](./web-app.md#extension-handshake-and-read-only-mode)). `reservedTags.test.ts` asserts no duplicates and that every reserved `view:` tag except those two parses. The user-facing description is the "Tag shortcuts" section of `Notes/TagApp Server Reference.md`, shown on `/reference`: update it with this list.

To add a reserved tag: new `meta:` tag, add a constant and list it in `RESERVED_TAGS`; new `view:` tag, add it to `VIEW_TAGS` only.

## Filtering

`filterData` (`filterData.ts`) runs in the browser, not on the server: the web app loads the whole library with `main.getAllContent` and filters it in memory ([web app](./web-app.md#state)). `FilterQuerySchema` is its input.

- `any`: item has at least one of these tags. `all`: item has every one. `none`: item has none of them (`ArrayHasAnyModified`, `ArrayHasAll` in `ArrayHelperFunctions.ts`).
- `any` and `none` accept wildcards: `*` matches any item with at least one tag, `Parent:*` matches any tag starting with `Parent:`. `all` is exact.
- `types`: empty means all types. `search`: Fuse.js fuzzy match on `title` (threshold 0.5), applied after the tag and type filters.
- `filterEntries` (`filterEntries.ts`) applies the same tag, type and search rules to any `{ name, type, tags? }` list (a gallery's files), without sorting.
- Result is always sorted by `added`: newest first when `orderByLatest`, else oldest first.

### Library filter (`filterLibrary`)

`filterLibrary(query, contentData, groups)` returns `LibraryEntry[]` (`{kind:"item", item}` or `{kind:"group", group, children}`), items and cards sorted together; `filterData` is unchanged. `FilterQuerySchema` gains optional `showGrouped`, `itemsOnly`, `searchDescription`, `groupSort` (`newestChild` default, `created`, `updated`).

- A grouped item (one of its ids has a record) is hidden unless it has `view:in-library`, or `showGrouped` / `itemsOnly` is on. Ids without a record never hide an item.
- An item with `view:hide-in-library` is dropped in both modes (also with `showGrouped`, and even with `view:in-library`), unless `any` or `all` contains that exact tag (wildcards like `view:*` do not count; `none` still excludes) or `ignoreHidden` is set. `ignoreHidden` is the group pages' flag (optional query field): `/group/:id` passes it so hidden items still list. Group cards are unaffected.
- Search mode 1 (default): item titles and group titles; a hidden child's match does not surface it. Mode 2 (`itemsOnly`): every item searched directly, no cards. `searchDescription` adds `extraData` in either mode.
- Tag filters on a card: `none` excludes on the group's own tags; `any`/`all` pass on the group's own tags or on any single child's tags (wildcards work). `types`: a card needs a child of a wanted type. Groups without children never appear.
- Order by `added` for items; cards by `groupSortKey` (newest child `added`, group `added`, or group `lastUpdated`); `orderByLatest` sets direction; ties keep items before cards.
