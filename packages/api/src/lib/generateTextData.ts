import { readdir } from "node:fs/promises";
import getCtype from "./getCtype";

export interface entry {
  name: string;
  type: "video" | "img";
}

// The input must be of form "${galleryName}.${id}""
export const generateTxtData = async (galleryNameWithID: string) => {
  const contents = (await readdir(`./media/Texts/${galleryNameWithID}`)).filter(
    (j) => j !== ".media" && !j.endsWith("txt-data.json"),
  );

  let mediaFiles = await readdir(
    `./media/Texts/${galleryNameWithID}/.media`,
  ).catch(() => []);

  const media: entry[] = mediaFiles.map((file) => ({
    name: file,
    type: getCtype(file)[0] as "video" | "img",
  }));

  return {
    Texts: contents,
    Media: media,
  };
};
