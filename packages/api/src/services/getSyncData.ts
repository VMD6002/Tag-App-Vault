import { readdir, stat } from "node:fs/promises";
import {
  ContentJsonSchema,
  type ContentJsonType,
  type ContentWebType,
  type CType,
} from "@tagapp/utils/types";
import { readJSON } from "fs-extra/esm";
import { customAlphabet } from "nanoid";
import z from "zod";
import { contentDataDB } from "../db/contentData.js";
import getCtype from "../lib/getCtype.js";
import { firstImage, getGalleryThumb } from "../lib/getGalleryThumb.js";

export interface NewContentType extends ContentJsonType {
  type: CType;
  /** `[coverExt, fileExt, "vtt"?]` for img/video, `[thumb]` otherwise. */
  ext: (string | undefined)[];
  /** Current name on disk; differs from `<title>.<id>` until prepareSync renames it. */
  name: string;
}

export const SYNC = "./Sync";
const CAPTIONS_TAG = "meta:caption";
const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  10,
);

/** Folder-based content types (`<name>.<type>/`) and how to find their thumbnail. */
const folderThumbs = new Map<
  string,
  (dir: string) => Promise<string | undefined>
>([
  ["gallery", getGalleryThumb],
  ["txt", (dir) => firstImage(`${dir}/.media`)],
  ["audio", (dir) => firstImage(`${dir}/.audio-covers`)],
]);

/** Names (inside ./Sync) of every file/folder that belongs to one content item. */
export const filesOf = (
  name: string,
  type: CType,
  [cover, ext, caption]: NewContentType["ext"],
) =>
  type === "img" || type === "video"
    ? [
        `cover.${name}.${cover}`,
        `${name}.${ext}`,
        ...(caption ? [`caption.${name}.vtt`] : []),
      ]
    : [`${name}.${type}`];

async function readContentJSON(name: string, source: unknown) {
  const parsed = ContentJsonSchema.safeParse(
    source ?? (await readJSON(`${SYNC}/${name}.json`)),
  );
  if (!parsed.success) {
    console.error(
      `[Sync Failed] Skipping ${name} due to the JSON validation errors below:`,
    );
    console.error(z.prettifyError(parsed.error));
    return null;
  }
  return parsed.data;
}

async function generateContentJSON(
  title: string,
  timePath: string,
): Promise<ContentJsonType> {
  const time = Math.floor((await stat(timePath)).mtimeMs / 1000);
  return {
    id: `gen_${nanoid()}`,
    title,
    tags: [],
    added: time,
    lastUpdated: time,
    extraData: "Generated Data",
  };
}

/**
 * Read-only scan of ./Sync. All writes live in prepareSync, so generated ids exist
 * only in the returned data until then.
 *
 * Items whose id is already in the library, or repeats one found earlier in this
 * scan, are logged and left in ./Sync. `unsyncable` lists the entries prepareSync
 * moves out.
 */
export async function getSyncData() {
  const entries = await readdir(SYNC, { withFileTypes: true });
  const names = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
  const folders = new Set(
    entries.filter((e) => e.isDirectory()).map((e) => e.name),
  );
  const jsons = new Set(names.filter((f) => f.endsWith(".json")));
  const files = new Set(names.filter((f) => !jsons.has(f)));
  const contents: Record<string, NewContentType> = {};

  // Bundles are split by prepareSync; read them here so a preview sees their metadata.
  const bundled = new Map<string, ContentWebType>();
  for (const file of jsons) {
    if (!file.startsWith("tdata.")) continue;
    const items: ContentWebType[] = await readJSON(`${SYNC}/${file}`);
    for (const item of Object.values(items)) {
      bundled.set(`${item.title}.${item.id}`, item);
    }
  }

  // cover.<name>.<ext> -> <name> => ext. Sorted so duplicates resolve the same way every run.
  const covers = new Map<string, string>();
  for (const file of [...files].sort()) {
    if (!file.startsWith("cover.")) continue;
    const [type, ext, name] = getCtype(file);
    if (type !== "img") continue;
    const key = name.slice("cover.".length);
    if (covers.has(key)) {
      console.warn(`[Sync] Duplicate cover ${file} ignored for ${key}`);
      continue;
    }
    covers.set(key, ext);
  }

  /**
   * Loads (or generates) the metadata of one item and records it. Everything it
   * consumed is removed from `files`/`folders`; whatever is left at the end is
   * unsyncable.
   */
  const register = async (
    name: string,
    type: CType,
    ext: NewContentType["ext"],
    timePath: string,
  ) => {
    const source = bundled.get(name);
    const loaded =
      source || jsons.has(`${name}.json`)
        ? await readContentJSON(name, source)
        : await generateContentJSON(name, timePath);
    if (!loaded) return;

    const consume = () => {
      for (const f of filesOf(name, type, ext)) {
        files.delete(f);
        folders.delete(f);
      }
    };

    if (contentDataDB.data[loaded.id] || contents[loaded.id]) {
      console.log(
        `[Sync Skipped] ${name}: id ${loaded.id} already exists, leaving it in Sync`,
      );
      consume();
      return;
    }

    // The caption tag always mirrors whether a caption file actually exists
    const tags = new Set(loaded.tags.map((t) => t.trim()).filter(Boolean));
    tags.delete(CAPTIONS_TAG);
    if (ext[2]) tags.add(CAPTIONS_TAG);

    consume();
    contents[loaded.id] = { ...loaded, tags: [...tags], type, ext, name };
  };

  const mediaTasks = [...files]
    .filter((f) => !/^(cover|caption)\./.test(f))
    .map(async (file) => {
      const [type, fileExt, name] = getCtype(file);
      if (type !== "img" && type !== "video") return;

      const coverExt = covers.get(name);
      if (!coverExt) {
        console.log(`[Sync Failed] No thumbnail found for ${name}`);
        return;
      }
      const ext: NewContentType["ext"] = [coverExt, fileExt];
      if (type === "video" && files.has(`caption.${name}.vtt`)) ext.push("vtt");
      await register(name, type, ext, `${SYNC}/${file}`);
    });

  const folderTasks = [...folders].map(async (folder) => {
    const dot = folder.lastIndexOf(".");
    const getThumb = folderThumbs.get(folder.slice(dot + 1));
    if (dot < 1 || !getThumb) return;

    const dir = `${SYNC}/${folder}`;
    const type = folder.slice(dot + 1) as CType;
    await register(folder.slice(0, dot), type, [await getThumb(dir)], dir);
  });

  for (const result of await Promise.allSettled([
    ...mediaTasks,
    ...folderTasks,
  ])) {
    if (result.status === "rejected") {
      console.error("[Sync Failed]", result.reason);
    }
  }

  return { contents, unsyncable: [...files, ...folders] };
}
