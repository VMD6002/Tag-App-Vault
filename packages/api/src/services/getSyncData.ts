import { readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import {
  ContentJsonSchema,
  type ContentJsonType,
  type ContentWebType,
  type CType,
} from "@tagapp/utils/types";
import { readJSON } from "fs-extra/esm";
import { customAlphabet } from "nanoid";
import z from "zod";
import getCtype from "../lib/getCtype.js";
import { firstImage, getGalleryThumb } from "../lib/getGalleryThumb.js";

export interface NewContentType extends ContentJsonType {
  type: CType;
  ext: string[];
}

const SYNC = "./Sync";
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

/**
 * Names (inside ./Sync) of every file/folder that belongs to one content item.
 * `ext` is `[coverExt, fileExt, "vtt"?]` for img/video, `[thumb]` otherwise.
 */
const filesOf = (name: string, type: CType, [cover, ext, caption]: any[]) =>
  type === "img" || type === "video"
    ? [
        `cover.${name}.${cover}`,
        `${name}.${ext}`,
        ...(caption ? [`caption.${name}.vtt`] : []),
      ]
    : [`${name}.${type}`];

async function readContentJSON(name: string) {
  const parsed = ContentJsonSchema.safeParse(
    await readJSON(`${SYNC}/${name}.json`),
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

/** Splits every `tdata.*.json` into one `<title>.<id>.json` per item, then removes it. */
async function splitTData(jsons: Set<string>) {
  for (const file of [...jsons].filter((f) => f.startsWith("tdata."))) {
    const items: ContentWebType[] = await readJSON(`${SYNC}/${file}`);
    await Promise.all(
      Object.values(items).map(async (item) => {
        const name = `${item.title}.${item.id}.json`;
        await writeFile(`${SYNC}/${name}`, JSON.stringify(item));
        jsons.add(name);
      }),
    );
    await rm(`${SYNC}/${file}`);
    jsons.delete(file);
  }
}

export async function getSyncData() {
  const entries = await readdir(SYNC, { withFileTypes: true });
  const names = entries.filter((e) => !e.isDirectory()).map((e) => e.name);
  const folders = new Set(
    entries.filter((e) => e.isDirectory()).map((e) => e.name),
  );
  const jsons = new Set(names.filter((f) => f.endsWith(".json")));
  const files = new Set(names.filter((f) => !jsons.has(f)));
  const contents: Record<string, NewContentType> = {};

  await splitTData(jsons);

  // cover.<name>.<ext> -> <name> => ext
  const covers = new Map<string, string>();
  for (const file of files) {
    if (!file.startsWith("cover.")) continue;
    const [type, ext, name] = getCtype(file);
    if (type !== "invalid") covers.set(name.slice("cover.".length), ext);
  }

  /**
   * Loads (or generates) the metadata of one item, makes sure its files are
   * named `<title>.<id>.*` and records it. Everything it consumed is removed
   * from `files`/`folders`; whatever is left at the end is unsyncable.
   */
  const register = async (
    name: string,
    type: CType,
    ext: any[],
    timePath: string,
  ) => {
    const hasJson = jsons.has(`${name}.json`);
    const loaded = hasJson
      ? await readContentJSON(name)
      : await generateContentJSON(name, timePath);
    if (!loaded) return;

    // The caption tag always mirrors whether a caption file actually exists
    const tags = loaded.tags.filter((t) => t !== CAPTIONS_TAG);
    if (ext[2]) tags.push(CAPTIONS_TAG);
    const data = { ...loaded, tags };

    const newName = `${data.title}.${data.id}`;
    if (newName !== name) {
      // Embed the id in every file (cover, media, caption) and in the JSON
      const from = filesOf(name, type, ext);
      const to = filesOf(newName, type, ext);
      await Promise.all(
        from.map((f, i) => rename(`${SYNC}/${f}`, `${SYNC}/${to[i]}`)),
      );
      await writeFile(`${SYNC}/${newName}.json`, JSON.stringify(data));
      if (hasJson) await rm(`${SYNC}/${name}.json`);
    }

    for (const f of filesOf(name, type, ext)) {
      files.delete(f);
      folders.delete(f);
    }
    contents[data.id] = { ...data, type, ext };
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
      const ext = [coverExt, fileExt];
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

  // Anything not consumed above can't be synced
  await Promise.all(
    [...files, ...folders].map((name) =>
      rename(`${SYNC}/${name}`, `./UnSyncable/${name}`).catch((error) =>
        console.error(`[Sync Failed] Could not move ${name}:`, error),
      ),
    ),
  );

  return contents;
}
