import { readdir, rm } from "node:fs/promises";
import { parse } from "node:path";
import { ORPCError, os } from "@orpc/server";
import z from "zod";
import { pathExists } from "../lib/fsBaseNameFunctions";

const audioExistsCheck = async (name: string, id: string) => {
  if (!(await pathExists(`./media/Audios/${name}.${id}`))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Audio with name ${name} and ID ${id} doesn't exist`,
    });
  }
};

/** Tracks of one audio item; a track's cover is the first file starting with `cover.<track name without extension>`. */
const listAudio = async (name: string, id: string) => {
  const dir = `./media/Audios/${name}.${id}`;
  let coverFiles: string[] = [];
  try {
    coverFiles = await readdir(`${dir}/.audio-covers`);
  } catch {}

  return (await readdir(dir))
    .filter((file) => file !== ".audio-covers")
    .map((audioFile) => ({
      name: audioFile,
      cover: coverFiles.find((file) =>
        file.startsWith(`cover.${parse(audioFile).name}`),
      ),
    }));
};

export const getAudioData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Audio Name or ID`,
      });
    }

    await audioExistsCheck(name, id);

    return listAudio(name, id);
  });

export const removeAudioContents = os
  .input(
    z.object({
      name: z.string(),
      id: z.string(),
      contents: z.string().array(),
    }),
  )
  .handler(async ({ input }) => {
    const { name, id, contents } = input;

    if (!name || !id || !contents.length) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Audio Name or ID or Contents`,
      });
    }

    await audioExistsCheck(name, id);

    await Promise.all(
      contents.map((content) =>
        rm(`./media/Audios/${name}.${id}/${content}`, {
          recursive: true,
          force: true,
        }),
      ),
    );

    return listAudio(name, id);
  });
