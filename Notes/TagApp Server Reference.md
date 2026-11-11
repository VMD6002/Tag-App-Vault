# TagApp Server Reference Guide

How content is named, laid out on disk, synced, and served. Written from the code (`packages/api/src/services/*`, `routers/*`, `apps/cli`, `apps/Caddyfile`); if this file and the code disagree, the code wins.

## Contents

1. [Core rules](#core-rules)
2. [Server root layout](#server-root-layout)
3. [Content types at a glance](#content-types-at-a-glance)
4. [Media folder structure](#media-folder-structure)
5. [Sync folder structure](#sync-folder-structure)
6. [Metadata JSON](#metadata-json)
7. [Sync process](#sync-process)
8. [Covers](#covers)
9. [Meta tags](#meta-tags)
10. [Generated files inside media](#generated-files-inside-media)
11. [Rename and delete behaviour](#rename-and-delete-behaviour)
12. [Groups](#groups)
13. [Serving files (Caddy)](#serving-files-caddy)
14. [Known issues](#known-issues)

---

## Core rules

| Rule                    | Detail                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name format**         | Every item is named `<title>.<id>`. Below, `<name>` always means that full string.                                                                                      |
| **Id is permanent**     | Changing a title renames the files; the `id` never changes.                                                                                                             |
| **Ids**                 | From the downloader (the item's id) or generated on sync as `gen_<10 alphanumerics>`.                                                                                   |
| **Title characters**    | The downloader replaces `\ / : * ? " < > \| %` and control characters with `_`. The server does not sanitize titles on sync, so titles must already be filesystem-safe. |
| **Type from extension** | File type is decided only by extension (see [Recognised extensions](#recognised-extensions)).                                                                           |
| **Folder items**        | Galleries, audio lists and text groups are folders. In `Sync/` the folder name ends in the type: `<name>.gallery`, `<name>.audio`, `<name>.txt`.                        |
| **Hidden folders**      | Dot-folders (`.covers`, `.captions`, `.media`, `.gallery-covers`, `.audio-covers`) hold support files and are never treated as content.                                 |

### Recognised extensions

| Type    | Extensions                                                |
| ------- | --------------------------------------------------------- |
| `img`   | `jxl` `jpg` `jpeg` `png` `webp` `svg` `avif` `apng` `gif` |
| `video` | `mp4` `webm` `avi` `mkv`                                  |
| `audio` | `mp3` `wav` `m4a` `opus`                                  |
| `txt`   | `txt` `md`                                                |

Anything else (for example `heic`) is not recognised and ends up in `UnSyncable/`.

---

## Server root layout

All server paths are relative to the server's working directory.

```txt
<server root>
├── settings.json           port + UI prefix (edit by hand, restart to apply)
├── Download/
│   ├── tmp.json            pending download queue (written by the server, read by the CLI)
│   └── cookies/<Site>.txt  optional, used by meta:yt-cookie (the CLI reads ./cookies/ from its own cwd, this folder)
├── Sync/                   staging area: finished downloads / files to import
├── UnSyncable/             files moved here when sync can't make sense of them
├── DB/
│   ├── contentData.json    Record<id, item>   (all synced content)
│   ├── groups.json         Record<id, group>  (group records; items carry the group ids)
│   └── tags.json           Record<tag, count> (usage counts, items and groups)
└── media/                  the library (next section)
```

---

## Content types at a glance

| Type      | `media/` dir | Shape in `Sync/`                                                   | Cover source                                                      | Web route      |
| --------- | ------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------- |
| `img`     | `Images`     | `<name>.<ext>` + `<name>.json`, plus optional `cover.<name>.<ext>` | `.covers/cover.<name>.<ext>`, generated if missing                | `/img/:id`     |
| `video`   | `Videos`     | same as `img`, plus optional `caption.<name>.vtt`                  | `.covers/cover.<name>.<ext>` (optional)                           | `/video/:id`   |
| `gallery` | `Galleries`  | `<name>.gallery/` + `<name>.json`                                  | first image in the folder, else first image in `.gallery-covers/` | `/gallery/:id` |
| `audio`   | `Audios`     | `<name>.audio/` + `<name>.json`                                    | first image in `.audio-covers/`                                   | `/audio/:id`   |
| `txt`     | `Texts`      | `<name>.txt/` + `<name>.json`                                      | first image in `.media/`                                          | `/txt/:id`     |

---

## Media folder structure

Final library layout (`media/`). Folder items lose their `.gallery`/`.audio`/`.txt` suffix when moved here.

```txt
media
├── Images
│   ├── .covers
│   │   ├── cover.<name>.<ext>
│   │   └── ...cover files
│   ├── <name>.<ext>
│   └── ...images
│
├── Videos
│   ├── .covers
│   │   ├── cover.<name>.<ext>
│   │   └── ...cover files
│   ├── .captions
│   │   ├── caption.<name>.vtt
│   │   └── ...caption files
│   ├── <name>.<ext>
│   └── ...videos
│
├── Galleries
│   └── <name>
│       ├── .gallery-covers
│       │   ├── cover.<file name>.<ext>
│       │   └── ...covers for videos in the gallery
│       ├── .gallery-data.json     (generated)
│       ├── .tags.json             (generated, per-file tags)
│       ├── <file>.<ext>           (img / video)
│       └── ...files
│
├── Audios
│   └── <name>
│       ├── .audio-covers
│       │   ├── cover.<audio file name>.<ext>
│       │   └── ...covers
│       ├── <audio file>.<mp3|wav|m4a|opus>
│       └── ...audio files
│
└── Texts
    └── <name>
        ├── .media
        │   ├── <file>.<ext>       (img / video used by the texts)
        │   └── ...
        ├── txt-data.json          (generated)
        ├── <chapter>.md
        └── ...chapters
```

Notes:

- `.gallery-covers` and `.audio-covers` are used instead of `.covers` so Caddy needs no extra rule for them (Caddy's `.covers` rules apply only under `Images/` and `Videos/`).
- Captions are only supported for **videos**. The file is `caption.<name>.vtt`, **not** `cover.<name>.vtt`.
- Audio covers are per track: a track `song.mp3` looks for a file in `.audio-covers/` starting with `cover.song`. (The track's extension, whatever it is, is dropped before matching.)
- Gallery video covers: `cover.<video file name>.<ext>`. A gallery with only videos uses the first file in `.gallery-covers/` as its thumbnail.

---

## Sync folder structure

What the server expects in `Sync/` before running sync. A `<name>.json` sidecar sits next to every item (it is optional, see [Metadata JSON](#metadata-json)).

```txt
Sync
├── cover.<name>.<ext>             image/video cover (opt.) ┐
├── <name>.<ext>                   image / video file       │ one img/video item
├── caption.<name>.vtt             video caption (optional) │
├── <name>.json                    metadata (optional)      ┘
│
├── <name>.gallery
│   ├── .gallery-covers/cover.<file name>.<ext>
│   └── <file>.<ext>               img / video files
├── <name>.json
│
├── <name>.audio
│   ├── .audio-covers/cover.<audio file name>.<ext>
│   └── <audio file>.<mp3|wav|m4a|opus>
├── <name>.json
│
├── <name>.txt
│   ├── .media/<file>.<ext>
│   └── <chapter>.md
├── <name>.json
│
└── tdata.<anything>.json          bundle of items (split on sync, see below)
```

What does **not** sync:

| Found in `Sync/`                                                                                                  | Result                                                   |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Image with no cover that `Bun.Image` can't decode (`svg`, `jxl`, and `avif` on Linux)                             | `UnSyncable/` (logged)                                   |
| `cover.*` or `caption.*` file with no matching media                                                              | `UnSyncable/`                                            |
| `cover.*` file that isn't an image, or a second cover for the same item (the alphabetically first extension wins) | `UnSyncable/`                                            |
| Item whose id is already in the library, or repeats another item's id in the same scan                            | stays in `Sync/` (logged), nothing changes               |
| Caption for an **image**                                                                                          | `UnSyncable/`                                            |
| Loose `.md`/`.txt`/`.mp3`/`.wav`/`.m4a`/`.opus` file (not in a folder)                                            | `UnSyncable/`                                            |
| Folder whose suffix isn't `.gallery`, `.audio` or `.txt`                                                          | `UnSyncable/`                                            |
| Unrecognised extension                                                                                            | `UnSyncable/`                                            |
| Item whose `<name>.json` is invalid or unreadable                                                                 | stays in `Sync/` with its JSON (logged), nothing changes |
| `<name>.json` with no matching item                                                                               | stays in `Sync/` (logged, returned as `orphanJsons`)     |

---

## Metadata JSON

Sidecar `<name>.json` (validated by `ContentJsonSchema`):

| Field         | Type     | Meaning                            |
| ------------- | -------- | ---------------------------------- |
| `id`          | string   | Permanent id                       |
| `title`       | string   | Display title and file-name prefix |
| `tags`        | string[] | Tags (counted in `DB/tags.json`)   |
| `extraData`   | string   | Free text notes                    |
| `cover`       | string?  | Cover file (see [Covers](#covers)) |
| `added`       | number   | Unix seconds                       |
| `lastUpdated` | number   | Unix seconds                       |

- Unknown keys are dropped by validation. The downloader's `url`, `scraper`, `download`, `contentUrl` do **not** survive sync.
- **No JSON present**: metadata is generated: `id = gen_<10 chars>`, `title = <file/folder name>`, `tags = []`, `extraData = "Generated Data"`, `added = lastUpdated = modified time` of the file (or folder).
- **`tdata.*.json`**: a JSON array of download items; each is split into its own `<title>.<id>.json`, then the bundle is deleted.
- If the JSON's `<title>.<id>` differs from the file names, all the item's files (cover, media, caption) are renamed to match the JSON, and the JSON is rewritten under the new name.
- The DB entry stored in `DB/contentData.json` is this data plus `type` (`img` | `video` | `gallery` | `audio` | `txt`).

---

## Sync process

`main.getSyncData` is a read-only preview. `main.sync` prepares `Sync/` and commits it. A lock (`lib/syncLock.ts`) makes overlapping calls wait for each other.

`getSyncData` returns `{ contents, unsyncable, orphanJsons }`. Ids it generates exist only in that response, so they differ between previews.

1. **Scan** (`services/getSyncData.ts`, writes nothing)
   1. Read any `tdata.*.json` for metadata.
   2. Index covers: every `cover.<name>.<ext>` image.
   3. Image/video: pair each media file with its cover and, for videos, `caption.<name>.vtt`.
   4. Folders: `.gallery`, `.audio`, `.txt` suffix decides the type; a thumbnail is resolved (see [Covers](#covers)).
   5. Load the sidecar JSON, or generate metadata in memory. Validate with Zod.
   6. Skip ids that are already in the library or repeated in this scan. They stay in `Sync/`.
   7. Trim and deduplicate tags, and drop empty ones.
   8. `meta:caption` is **forced to mirror reality**: removed from the tags, then added back only if a caption file exists. Users cannot set it by hand.
2. **Prepare** (`services/prepareSync.ts`, `sync` only)
   1. Split any `tdata.*.json` into per-item JSON, then run the scan.
   2. Generate missing image covers: `cover.<name>.webp`, fitted inside 800x800 without enlarging, quality 80.
   3. Write the sidecar and rename files to `<title>.<id>` if needed.
   4. Move everything left over to `UnSyncable/`.
3. **Commit** (`services/syncContent.ts`), per item:

| Type                        | Moves (`Sync/` → `media/`)                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `img` / `video`             | `cover.<name>.<ext>` (if any) → `<Dir>/.covers/` · `<name>.<ext>` → `<Dir>/` · `caption.<name>.vtt` → `Videos/.captions/` |
| `gallery` / `audio` / `txt` | `<name>.<type>/` → `<Dir>/<name>/` (suffix dropped)                                                                       |

Then the item is added to `DB/contentData.json`, tag counts are incremented, both are written to disk, and only then is the sidecar `<name>.json` deleted. If a move or a DB write fails, the item's moves are rolled back and it stays in `Sync/`. A crash after the moves but before the DB write leaves the files in `media/` with the sidecar reported as an orphan, so its metadata is still there to recover by hand.

The downloader (`apps/cli`) feeds this step: it downloads into `./tmp`, then moves all `*.<id>.*` files into `Sync/` and writes `<title>.<id>.json` last.

---

## Covers

The `cover` field in the DB depends on type:

| Type            | How the cover is found                                                                                                                                         | `cover` value stored                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `img` / `video` | By naming convention: `.covers/cover.<name>.<ext>`. Images get a generated one if missing. Videos may have none, and the library card then shows the type icon | not used by the UI (path is built from title + id)                                      |
| `gallery`       | First image (natural order) in the gallery root; if none, first image in `.gallery-covers/`; if none, no cover                                                 | path relative to the gallery folder, e.g. `pic.jpg` or `.gallery-covers/cover.clip.jpg` |
| `audio`         | First image (natural order) in `.audio-covers/`; if none, no cover                                                                                             | file name in `.audio-covers/`                                                           |
| `txt`           | First image (natural order) in `.media/`                                                                                                                       | file name in `.media/`                                                                  |

Changing covers later:

- Any type: `main.setCover` changes the stored `cover` value (for gallery, audio and txt).
- Video: `video.setCoverGivenFile` replaces `.covers/cover.<name>.<ext>` with an uploaded file.
- Gallery: `gallery.setCoverGivenFile` writes `.gallery-covers/cover.<file>.<ext>` for a gallery file.

---

## Tag shortcuts (meta: and view: tags)

Two reserved tag families have a special meaning. Everything else is a plain label. Tags are exact, case-sensitive strings. **All reserved tags below always appear in the tag pickers**, even if no item uses them yet, so you can pick them instead of typing them.

### `meta:` tags: behaviour

`meta:` tags change how an item is downloaded or stored. Each is read by one part of the system.

| Meta tag               | Read by | Effect                                                                                                                                                                     |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta:caption`         | Sync    | A caption `.vtt` exists. **Managed automatically** on sync from file presence; any manual value is overwritten, so don't add or remove it by hand.                         |
| `meta:yt-cookie`       | CLI     | Download with `./cookies/<Site>.txt` (relative to the CLI's cwd, so `Download/cookies/`). Requires a `Site:<name>` tag and that cookie file, otherwise the download fails. |
| `meta:different-cover` | CLI     | Download the cover from the item's `cover` URL (direct fetch) instead of yt-dlp's thumbnail. Requires `cover` to be set.                                                   |

### `view:` tags: gallery display defaults

`view:` tags set how a gallery opens. Only the web app reads them; they never change files. They apply to the gallery page.

| View tag                                                  | Effect                                                                                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view:sort-a-z` / `view:sort-z-a`                         | Sort by name ascending / descending                                                                                                                                                            |
| `view:sort-newest` / `view:sort-oldest`                   | Sort by created date, newest / oldest first                                                                                                                                                    |
| `view:sort-modified-newest` / `view:sort-modified-oldest` | Sort by modified date, newest / oldest first                                                                                                                                                   |
| `view:list`                                               | Single-column layout                                                                                                                                                                           |
| `view:grid-auto`                                          | Responsive grid (column count follows the screen)                                                                                                                                              |
| `view:grid-2` / `view:grid-3` / `view:grid-4`             | Fixed grid of 2 / 3 / 4 columns                                                                                                                                                                |
| `view:autoplay` / `view:no-autoplay`                      | Videos autoplay in the gallery / do not                                                                                                                                                        |
| `view:width-10` … `view:width-100`                        | Single-column width in percent (list layout only), e.g. `view:width-60`. The picker offers steps of 10; any value from 10 to 100 works if typed.                                               |
| `view:hide-in-library`                                    | Hides the item from the main Library (any item, handy for galleries). It still shows when you filter with this tag in Any of / All of, and always inside its group page. Not a display option. |
| `view:in-library`                                         | A grouped item still shows in the main library (otherwise grouped items are hidden and only their group card shows). Not a display option: it has no effect on the gallery page.               |

**Which value wins** for each option (sort, layout, width, autoplay):

1. Your own choice on that gallery (the options bar). It is kept in this browser.
2. The gallery's `view:` tag.
3. The default from the Settings page.

"Reset" in the gallery options forgets your own choices and returns to the tag values (or the Settings defaults when there is no tag). A tag never overrides what you picked, and removing a tag takes effect the next time the gallery opens.

**Conflicts:** if one item has several tags for the same option (say `view:list` and `view:grid-2`), the first one in the item's tag order wins. Unknown `view:` tags and widths outside 10 to 100 are ignored.

---

## Generated files inside media

Created and refreshed by the server; safe to delete (they are rebuilt), and ignored when listing content.

| File                 | Location            | Content                                                                               |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `.gallery-data.json` | `Galleries/<name>/` | Cached listing: per file `name`, `type`, `createdAt`, `modifiedAt`, `cover?`, `tags?` |
| `.tags.json`         | `Galleries/<name>/` | `Record<file name, tags[]>`: tags of individual gallery files                         |
| `txt-data.json`      | `Texts/<name>/`     | `{ Texts: string[] (chapter files), Media: {name, type}[] }`                          |

Rebuild with the `refreshGalleryData` / `refreshTxtData` procedures.

---

## Rename and delete behaviour

| Action                               | What happens on disk                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Change title** (`main.setContent`) | Files renamed `<oldTitle>.<id>` → `<newTitle>.<id>` (cover, media, caption, or the folder). Rolled back on error. Tag diffs update `DB/tags.json`. |
| **Delete** (`main.removeContents`)   | Two phases: files are renamed to `*.del`, then removed. Rolled back if a step fails. Tag counts are decremented; the DB entry is deleted.          |
| **Tag count repair**                 | `fix.hardResetTagCount` / `fix.softResetTagCount` recompute `DB/tags.json` (the hard reset counts group tags too).                                 |

---

## Groups

A group collects related items (same topic or author). Items stay where they are on disk; a group is only a record in `DB/groups.json` plus a `groups` list of ids on each item in `DB/contentData.json`, so grouping, renaming and deleting never move files.

- Grouped items are hidden from the main Library and appear as one group card; give an item the tag `view:in-library` to keep it visible there too, or switch on "Show grouped items".
- **Library search** has two modes: groups and items by title (default), or items only (grouped items included). "Search descriptions too" also searches group descriptions.
- **`/group`** lists every group, including empty ones: Fix Data, merge several groups into one, disband (remove the group, keep its items) and delete. **`/group/:id`** is the library scoped to one group, with Stats, edit (title, description, tags, cover, id), Fix Data, disband and delete group.
- **Delete group** deletes the group and the items only in it. Items that are also in other groups are listed; they only lose this group unless you tick them to be deleted too (same two-phase delete as any item).
- **Fix Data** recreates missing group records for ids found on items (title = id) and clears an empty cover; nothing else. Sync does the first part automatically.
- **Cover** is a URL (one of the items' covers or any other). Empty = the card shows a child's cover, picked by the cover setting on the Settings page (newest, oldest, first with a cover).
- Editing controls need the extension, like the rest of the web app. Details: `docs/groups.md`.

---

## Serving files (Caddy)

Caddy listens on `:5000`; everything outside `/media/*` is proxied to the app on `localhost:5001`.

| Request                                              | Behaviour                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/media/Images/.covers/*`, `/media/Videos/.covers/*` | `Cache-Control: no-store`; tries `<path>.avif`, `.jpg`, `.jpeg`, `.png`, `.webp`, then the exact path |
| `/media/Images/*`                                    | tries the same image extensions, then exact path                                                      |
| `/media/Videos/*`                                    | tries exact path, then `.mp4`, `.webm`, `.mkv`                                                        |
| other `/media/*`                                     | plain static file                                                                                     |
| CORS                                                 | `Access-Control-Allow-Origin: *`, GET/OPTIONS only                                                    |

---

## Known issues

Current sync behaviour that is likely unintended (remove entries once fixed):

- **Leftovers move to `UnSyncable/` on every sync**, so a file that is still being copied in is moved away.
- **Loose audio files** (`mp3`, `wav`, `m4a`, `opus`, for example an audio-only yt-dlp download) are recognised but cannot sync outside an `.audio` folder, so they land in `UnSyncable/`.
