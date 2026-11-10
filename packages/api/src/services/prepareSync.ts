import { readdir, rename, rm } from "node:fs/promises";
import type { ContentWebType } from "@tagapp/utils/types";
import { filesOf, getSyncData, SYNC } from "./getSyncData.js";

/** Splits every `tdata.*.json` into one `<title>.<id>.json` per item, then removes it. */
export async function splitTData() {
  const names = await readdir(SYNC);
  for (const file of names.filter(
    (f) => f.startsWith("tdata.") && f.endsWith(".json"),
  )) {
    const items: ContentWebType[] = await Bun.file(`${SYNC}/${file}`).json();
    await Promise.all(
      Object.values(items).map((item) =>
        Bun.write(
          `${SYNC}/${item.title}.${item.id}.json`,
          JSON.stringify(item),
        ),
      ),
    );
    await Bun.file(`${SYNC}/${file}`).delete();
  }
}

/**
 * The writing half of a scan: splits bundles, generates missing image covers,
 * writes missing or outdated sidecars, renames items to `<title>.<id>` and moves
 * leftovers to ./UnSyncable. Returns the items that are ready to sync.
 */
export async function prepareSync() {
  await splitTData();
  const { contents, unsyncable } = await getSyncData();

  for (const item of Object.values(contents)) {
    const { name: oldName, type, ext, ...rest } = item;
    const newName = `${item.title}.${item.id}`;
    try {
      if (type === "img" && !ext[0]) {
        await new Bun.Image(`${SYNC}/${oldName}.${ext[1]}`)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .write(`${SYNC}/cover.${oldName}.webp`);
        ext[0] = "webp";
      }

      if (newName !== oldName) {
        // Embed the id in every file (cover, media, caption) and in the JSON
        const from = filesOf(oldName, type, ext);
        const to = filesOf(newName, type, ext);
        await Promise.all(
          from.map((f, i) => rename(`${SYNC}/${f}`, `${SYNC}/${to[i]}`)),
        );
        await Bun.write(`${SYNC}/${newName}.json`, JSON.stringify(rest));
        await rm(`${SYNC}/${oldName}.json`, { force: true });
        item.name = newName;
      }
    } catch (error) {
      console.error(`[Sync Failed] Could not prepare ${oldName}:`, error);
      unsyncable.push(...filesOf(oldName, type, ext));
      delete contents[item.id];
    }
  }

  // Anything not consumed above can't be synced
  await Promise.all(
    unsyncable.map((name) =>
      rename(`${SYNC}/${name}`, `./UnSyncable/${name}`).catch((error) =>
        console.error(`[Sync Failed] Could not move ${name}:`, error),
      ),
    ),
  );

  return contents;
}
