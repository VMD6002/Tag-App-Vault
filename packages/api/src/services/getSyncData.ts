import { readdir } from "node:fs/promises";
import {
  ContentJsonSchema,
  type ContentJsonType,
  type ContentWebType,
  type CType,
} from "@tagapp/utils/types";
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
        ...(cover ? [`cover.${name}.${cover}`] : []),
        `${name}.${ext}`,
        ...(caption ? [`caption.${name}.vtt`] : []),
      ]
    : [`${name}.${type}`];

async function readContentJSON(dir: string, name: string, source: unknown) {
  const parsed = ContentJsonSchema.safeParse(
    source ??
      (await Bun.file(`${dir}/${name}.json`)
        .json()
        .catch((error) => {
          console.error(`[Sync Failed] Could not read ${name}.json:`, error);
        })),
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
  const time = Math.floor((await Bun.file(timePath).stat()).mtimeMs / 1000);
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
 * Read-only scan of `dir` (./Sync by default; the direct download pipeline scans one
 * staging folder per item). All writes live in prepareSync, so generated ids and
 * covers exist only in the returned data until then.
 *
 * Items whose id is already in the library, or repeats one found earlier in this
 * scan, are logged and left in ./Sync. `unsyncable` lists the entries prepareSync
 * moves out; `orphanJsons` lists sidecars no item used, which stay where they are.
 */
export async function getSyncData(dir = SYNC) {
  const entries = await readdir(dir, { withFileTypes: true });
  const names = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
  const folders = new Set(
    entries.filter((e) => e.isDirectory()).map((e) => e.name),
  );
  const jsons = new Set(names.filter((f) => f.endsWith(".json")));
  const files = new Set(names.filter((f) => !jsons.has(f)));
  const contents: Record<string, NewContentType> = {};
  const usedJsons = new Set<string>();

  // Bundles are split by prepareSync; read them here so a preview sees their metadata.
  const bundled = new Map<string, ContentWebType>();
  for (const file of jsons) {
    if (!file.startsWith("tdata.")) continue;
    usedJsons.add(file);
    const items: ContentWebType[] = await Bun.file(`${dir}/${file}`).json();
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
    const consume = () => {
      for (const f of filesOf(name, type, ext)) {
        files.delete(f);
        folders.delete(f);
      }
    };

    const loaded =
      source || jsons.has(`${name}.json`)
        ? await readContentJSON(dir, name, source)
        : await generateContentJSON(name, timePath);
    usedJsons.add(`${name}.json`);
    if (!loaded) {
      // Invalid JSON: leave the item and its JSON in Sync so fixing the JSON is enough
      consume();
      return;
    }

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

      // A missing image cover is generated by prepareSync; videos may go without one.
      const ext = [covers.get(name), fileExt];
      if (type === "video" && files.has(`caption.${name}.vtt`)) ext.push("vtt");
      await register(name, type, ext, `${dir}/${file}`);
    });

  const folderTasks = [...folders].map(async (folder) => {
    const dot = folder.lastIndexOf(".");
    const getThumb = folderThumbs.get(folder.slice(dot + 1));
    if (dot < 1 || !getThumb) return;

    const folderDir = `${dir}/${folder}`;
    const type = folder.slice(dot + 1) as CType;
    await register(
      folder.slice(0, dot),
      type,
      [await getThumb(folderDir)],
      folderDir,
    );
  });

  for (const result of await Promise.allSettled([
    ...mediaTasks,
    ...folderTasks,
  ])) {
    if (result.status === "rejected") {
      console.error("[Sync Failed]", result.reason);
    }
  }

  const orphanJsons = [...jsons].filter((json) => !usedJsons.has(json));
  for (const json of orphanJsons) {
    console.warn(`[Sync] ${json} has no matching item, leaving it in Sync`);
  }

  return { contents, unsyncable: [...files, ...folders], orphanJsons };
}
