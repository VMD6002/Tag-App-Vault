import { writeFile, stat, readdir, rename } from "node:fs/promises";
import { pathExists, readJSON } from "fs-extra/esm";
import getCtype from "../lib/getCtype.js";
import { customAlphabet } from "nanoid";
import {
  ContentJsonSchema,
  type ContentWebType,
  type ContentJsonType,
  type CType,
} from "@tagapp/utils/types";
import { getGalleryThumb } from "../lib/getGalleryThumb.js";
import z from "zod";

export interface NewContentType extends ContentJsonType {
  type: CType;
  ext: string[];
}

let Folders: Set<string> = new Set();
let Files: Set<string> = new Set();
let NewContents = new Map<string, NewContentType>();

function AddToNewContents(Temp: ContentJsonType, FileExt: any[], ctype: CType) {
  NewContents.set(Temp.id, {
    ...Temp,
    type: ctype,
    ext: FileExt,
  });
}

const capitalLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const smallLetter = "abcdefghijklmnopqrstuvwxyz";
const number = "1234567890";
const nanoid = customAlphabet(`${smallLetter}${number}${capitalLetter}`, 10);

async function GenerateAndAddToNewContents(
  name: string,
  fileExt: any[],
  ctype: CType,
  timePath: string,
) {
  const id = "gen_" + nanoid();
  const time = Math.floor((await stat(timePath)).mtime.getTime() / 1000);
  const jsonData: ContentJsonType = {
    id,
    title: name,
    tags: [],
    added: time,
    lastUpdated: time,
    extraData: `Generated Data`,
  };
  // Embed ID into file with generated data
  await writeFile(`./Sync/${name}.${id}.json`, JSON.stringify(jsonData));

  switch (ctype) {
    case "img":
    case "video":
      await rename(
        `./Sync/cover.${name}.${fileExt[0]}`,
        `./Sync/cover.${name}.${id}.${fileExt[0]}`,
      );
      await rename(
        `./Sync/${name}.${fileExt[1]}`,
        `./Sync/${name}.${id}.${fileExt[1]}`,
      );
      if (fileExt[3]) {
        // Renaming the caption file if it exists
        await rename(
          `./Sync/caption.${name}.vtt`,
          `./Sync/caption.${name}.${id}.vtt`,
        );
      }
      break;
    case "audio":
    case "txt":
    case "gallery":
      await rename(`./Sync/${name}.${ctype}`, `./Sync/${name}.${id}.${ctype}`);
      break;
  }

  NewContents.set(id, {
    ...jsonData,
    type: ctype,
    ext: fileExt,
  });
}

async function readContentJSONFile(path: string) {
  const jsonData = await readJSON(path);
  const data = ContentJsonSchema.safeParse(jsonData);
  if (!data.success) {
    console.error(
      `[Sync Failed] Skipping ${path.slice(6, -5)} Sync due below JSON Validation Errors:`,
    );
    console.log(z.prettifyError(data.error));
    return null;
  }
  return data.data;
}

export async function getSyncData() {
  Folders = new Set();
  Files = new Set();
  NewContents = new Map();

  const entries = await readdir("./Sync", { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) Folders.add(entry.name);
    else Files.add(entry.name);
  }

  // Remove all json files from Files set and split up tdata files
  await Promise.all(
    [...Files].map(async (file) => {
      if (!file.endsWith(".json")) return;
      Files.delete(file);
      if (!file.startsWith("tdata.")) return;
      const UnSplittedData: ContentWebType[] = await readJSON(`./Sync/${file}`);
      for (const Key in UnSplittedData) {
        const data = UnSplittedData[Key]!;
        await writeFile(
          `./Sync/${data.title}.${data.id}.json`,
          JSON.stringify(data),
        );
      }
    }),
  );

  // Remove all cover files from Files set and add them to CoverFiles map
  const CoverFiles = new Map<string, string>();
  for (const file of Files) {
    if (file.startsWith("cover.")) {
      const [Ctype, FileExt, Name] = getCtype(file);
      if (Ctype === "invalid") continue;
      CoverFiles.set(Name.replace("cover.", ""), FileExt);
      Files.delete(file);
    }
  }

  // Process images and videos. Files
  await Promise.all(
    Array.from(Files).map(async (file) => {
      const [Ctype, FileExt, Name] = getCtype(file);
      if (Ctype === "invalid") return;
      if (!CoverFiles.has(Name)) {
        console.log(`[Sync Failed] No thumbnail found for ${Name}`);
        return;
      }
      switch (Ctype) {
        case "img":
          if (await pathExists(`./Sync/${Name}.json`)) {
            const JsonData = await readContentJSONFile(`./Sync/${Name}.json`);
            if (!JsonData) break;
            AddToNewContents(JsonData, [CoverFiles.get(Name), FileExt], Ctype);
            Files.delete(`${Name}.json`);
            Files.delete(file);
            break;
          }
          GenerateAndAddToNewContents(
            Name,
            [CoverFiles.get(Name), FileExt],
            Ctype,
            `./Sync/${file}`,
          );
          Files.delete(file);
          break;
        case "video":
          const fileExts = [CoverFiles.get(Name), FileExt];
          if (await pathExists(`./Sync/${Name}.json`)) {
            const JsonData = await readContentJSONFile(`./Sync/${Name}.json`);
            if (!JsonData) break;
            AddToNewContents(JsonData, fileExts, Ctype);
            Files.delete(`caption.${Name}.vtt`);
            Files.delete(`${Name}.json`);
          } else {
            if (await pathExists(`./Sync/caption.${Name}.vtt`)) {
              Files.delete(`caption.${Name}.vtt`);
              fileExts.push("vtt");
            }
            GenerateAndAddToNewContents(
              Name,
              fileExts,
              Ctype,
              `./Sync/${file}`,
            );
          }
          Files.delete(file);
          break;
      }
    }),
  );

  // Process Galleries, Audio and Text. Folders

  // Galleries
  await Promise.all(
    Array.from(Folders).map(async (folder) => {
      if (!folder.endsWith("gallery")) return;
      const Name = folder.slice(0, -8);
      const Thumb = await getGalleryThumb(`./Sync/${folder}`);

      if (await pathExists(`./Sync/${Name}.json`)) {
        const JsonData = await readContentJSONFile(`./Sync/${Name}.json`);
        if (!JsonData) return;
        AddToNewContents(JsonData, [Thumb], "gallery");
        Files.delete(`${Name}.json`);
      } else {
        GenerateAndAddToNewContents(
          Name,
          [Thumb],
          "gallery",
          `./Sync/${folder}`,
        );
      }
      Folders.delete(folder);
    }),
  );

  // Txts
  await Promise.all(
    Array.from(Folders).map(async (folder) => {
      if (!folder.endsWith("txt")) return;
      const Name = folder.slice(0, -4);
      let Thumb = (
        await readdir(`./Sync/${folder}/.media`).catch(() => [])
      ).find((f) => getCtype(f)[0] === "img");
      if (await pathExists(`./Sync/${Name}.json`)) {
        const JsonData = await readContentJSONFile(`./Sync/${Name}.json`);
        if (!JsonData) return;
        AddToNewContents(JsonData, [Thumb], "txt");
        Files.delete(`${Name}.json`);
      } else {
        GenerateAndAddToNewContents(Name, [Thumb], "txt", `./Sync/${folder}`);
      }
      Folders.delete(folder);
    }),
  );

  // Audio
  await Promise.all(
    Array.from(Folders).map(async (folder) => {
      if (!folder.endsWith("audio")) return;
      const Name = folder.slice(0, -6);
      let Thumb = await readdir(`./Sync/${folder}/.audio-covers`).catch(
        () => [],
      );
      if (await pathExists(`./Sync/${Name}.json`)) {
        const JsonData = await readContentJSONFile(`./Sync/${Name}.json`);
        if (!JsonData) return;
        AddToNewContents(JsonData, [Thumb], "audio");
        Files.delete(`${Name}.json`);
      } else {
        GenerateAndAddToNewContents(Name, [Thumb], "audio", `./Sync/${folder}`);
      }
      Folders.delete(folder);
    }),
  );

  await Promise.all(
    Array.from(new Set([...Files, ...Folders])).map(async (content) => {
      await rename(`./Sync/${content}`, `./UnSyncable/${content}`);
    }),
  );

  return Object.fromEntries(NewContents);
}
