# Disk layout

Scope: the runtime directory tree, how each content type is shaped on disk, recognised extensions, and the helper files the server generates. Paths are relative to the server's working directory. Longer prose guide with the same layout: `Notes/TagApp Server Reference.md` (also rendered at `#/reference`); code wins where they differ.

## Runtime tree

```
settings.json              {port, prefix}
DB/contentData.json        Record<id, ContentServerType>
DB/tags.json               Record<tag, count>
Download/tmp.json          pending download queue
Download/cookies/<Site>.txt  optional yt-dlp cookies (CLI cwd is Download/)
Sync/  UnSyncable/         staging in / rejected
media/
  Images/   .covers/cover.<title>.<id>.<ext>   <title>.<id>.<ext>
  Videos/   .covers/ .captions/caption.<title>.<id>.vtt   <title>.<id>.<ext>
  Galleries/<title>.<id>/  .gallery-covers/  <files>
  Audios/<title>.<id>/     .audio-covers/    <files>
  Texts/<title>.<id>/      .media/           <name>.md
```

- `createAppDirs` (`apps/server/src/lib/createAppDirs.ts`) creates at startup: `Sync`, `UnSyncable`, `Download`, `DB`, `media/Videos/.covers`, `media/Videos/.captions`, `media/Images/.covers`, `media/Audios`, `media/Texts`, `media/Galleries`.
- Folder items in `Sync/` are named `<title>.<id>.gallery|audio|txt/` with the same inner layout. Dot-folders hold support files and are never content.
- Gallery and audio use `.gallery-covers` / `.audio-covers` rather than `.covers` so Caddy needs no extra rules ([deployment](./deployment.md)).
- Item names: [domain model](./domain-model.md#identity). Where files come from and move: [sync pipeline](./sync-pipeline.md).

## Recognised extensions

Decided by extension only (`packages/api/src/lib/getCtype.ts`); anything else ends up in `UnSyncable/`.

| Type    | Extensions                                |
| ------- | ----------------------------------------- |
| `img`   | `jxl jpg jpeg png webp svg avif apng gif` |
| `video` | `mp4 webm avi mkv`                        |
| `audio` | `mp3 wav m4a opus`                        |
| `txt`   | `txt md`                                  |

Loose files in `Sync/` only sync as `img` or `video` (so loose `mp3 wav m4a opus` go to `UnSyncable/`); `gallery`, `audio` and `txt` items arrive as suffixed folders.

## Covers and thumbnails

- img and video: `media/<Dir>/.covers/cover.<name>.<ext>`; `syncContent` sets no `cover` field for them. Videos may have none. Image covers are generated on sync (800px max, webp).
- gallery: thumbnail is the first image (natural sort) in the folder root, else the first image in `.gallery-covers/` (`getGalleryThumb`). audio: first image in `.audio-covers/`. txt: first image in `.media/`. `syncContent` stores that file name in the item's `cover` field; `main.setCover` changes it later (the gallery and audio pages use it to pick another file).
- Covers are served with no-cache headers: [deployment](./deployment.md).

## Files the server generates

| File                                  | Written by                  | Holds                                                                                       |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `Galleries/<name>/.gallery-data.json` | `gallery.*` routers         | Array of `entry` (`name`, `type`, `createdAt`, `modifiedAt`, `cover?`) plus per-file `tags` |
| `Galleries/<name>/.tags.json`         | `gallery.updateContentTags` | `Record<fileName, string[]>` per-file tags                                                  |
| `Texts/<name>/txt-data.json`          | `text.*` routers            | `{Texts: string[], Media: {name, type}[]}`                                                  |
| `Audios/<name>/`                      | none                        | No cache file; `getAudioData` lists the folder every time                                   |

Regenerate with `gallery.refreshGalleryData` / `text.refreshTxtData`. Generation lists the folder (`generateGalleryData`, `generateTxtData`) and `generateGalleryData` deletes covers in `.gallery-covers` that match no file.
