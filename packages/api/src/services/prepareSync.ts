import { readdir, rename, rm } from "node:fs/promises";
import type { ContentWebType } from "@tagapp/utils/types";
import { filesOf, getSyncData, SYNC } from "./getSyncData.js";

/** Splits every `tdata.*.json` into one `<title>.<id>.json` per item, then removes it. */
export async function splitTData(dir = SYNC) {
  const names = await readdir(dir);
  for (const file of names.filter(
    (f) => f.startsWith("tdata.") && f.endsWith(".json"),
  )) {
    const items: ContentWebType[] = await Bun.file(`${dir}/${file}`).json();
    await Promise.all(
      Object.values(items).map((item) =>
        Bun.write(`${dir}/${item.title}.${item.id}.json`, JSON.stringify(item)),
      ),
    );
    await Bun.file(`${dir}/${file}`).delete();
  }
}

/**
 * The writing half of a scan of `dir` (./Sync by default): splits bundles, generates missing image covers,
 * writes missing or outdated sidecars, renames items to `<title>.<id>` and moves
 * leftovers to ./UnSyncable. Returns the items that are ready to sync.
 */
export async function prepareSync(dir = SYNC) {
  await splitTData(dir);
  const { contents, unsyncable } = await getSyncData(dir);

  for (const item of Object.values(contents)) {
    const { name: oldName, type, ext, ...rest } = item;
    const newName = `${item.title}.${item.id}`;
    try {
      if (type === "img" && !ext[0]) {
        await new Bun.Image(`${dir}/${oldName}.${ext[1]}`)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .write(`${dir}/cover.${oldName}.webp`);
        ext[0] = "webp";
      }

      if (newName !== oldName) {
        // Embed the id in every file (cover, media, caption) and in the JSON
        const from = filesOf(oldName, type, ext);
        const to = filesOf(newName, type, ext);
        await Promise.all(
          from.map((f, i) => rename(`${dir}/${f}`, `${dir}/${to[i]}`)),
        );
        await Bun.write(`${dir}/${newName}.json`, JSON.stringify(rest));
        await rm(`${dir}/${oldName}.json`, { force: true });
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
      rename(`${dir}/${name}`, `./UnSyncable/${name}`).catch((error) =>
        console.error(`[Sync Failed] Could not move ${name}:`, error),
      ),
    ),
  );

  return contents;
}
