import { readdir, rm, stat } from "node:fs/promises";
import getCtype from "./getCtype";

export interface entry {
  name: string;
  type: "video" | "img";
  createdAt: number;
  modifiedAt: number;
  cover?: string;
}

// The input must be of form "${galleryName}.${id}""
export const generateGalleryData = async (galleryNameWithID: string) => {
  const contents = (
    await readdir(`./media/Galleries/${galleryNameWithID}`)
  ).filter((j) => j !== ".gallery-covers" && !j.endsWith("gallery-data.json"));

  let galleryCovers = await readdir(
    `./media/Galleries/${galleryNameWithID}/.gallery-covers`,
  ).catch(() => []);

  const data = await Promise.all(
    contents.map(async (file) => {
      const [type, _, name] = getCtype(file);

      const entry: entry = {
        name: file,
        type: type as "video" | "img",
        createdAt: 0,
        modifiedAt: 0,
      };

      const entryStats = await stat(
        `./media/Galleries/${galleryNameWithID}/${file}`,
      );

      const oldestDate = Math.min(
        entryStats.birthtimeMs > 0 ? entryStats.birthtimeMs : Infinity,
        entryStats.mtimeMs > 0 ? entryStats.mtimeMs : Infinity,
        entryStats.ctimeMs > 0 ? entryStats.ctimeMs : Infinity,
      );

      entry.createdAt = Math.floor(oldestDate / 1000);
      entry.modifiedAt = Math.floor(entryStats.mtimeMs / 1000);

      galleryCovers = galleryCovers.filter((cover) => {
        if (cover.slice(6).startsWith(name)) {
          entry.cover = cover;
          return false;
        }
        return true;
      });

      return entry;
    }),
  );

  await Promise.all(
    galleryCovers.map((cover) =>
      rm(`./media/Galleries/${galleryNameWithID}/.gallery-covers/${cover}`),
    ),
  );

  return data.sort((a, b) => a.createdAt - b.createdAt);
};
