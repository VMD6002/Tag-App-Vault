import { ORPCError, os } from "@orpc/server";
import { pathExists } from "fs-extra";
import z from "zod";
import { readdir, rm } from "node:fs/promises";

const audioExistsCheck = async (name: string, id: string) => {
  if (!(await pathExists(`./media/Audios/${name}.${id}`))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Audio with name ${name} and ID ${id} doesn't exist`,
    });
  }
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

    const coverFiles = await readdir(
      `./media/Audios/${name}.${id}/.audio-covers`,
    );

    const audioData = (await readdir(`./media/Audios/${name}.${id}`))
      .filter((file) => file !== ".audio-covers")
      .map((audioFile) => ({
        name: audioFile,
        cover: coverFiles.find(
          (file) => file.startsWith("cover." + audioFile.slice(0, -4)), // This is setup specifically for .mp3 and .wav files only
        ),
      }));

    return audioData;
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

    const coverFiles = await readdir(
      `./media/Audios/${name}.${id}/.audio-covers`,
    );

    const audioData = (await readdir(`./media/Audios/${name}.${id}`))
      .filter((file) => file !== ".audio-covers")
      .map((audioFile) => ({
        name: audioFile,
        cover: coverFiles.find(
          (file) => file.startsWith("cover." + audioFile.slice(0, -4)), // This is setup specifically for .mp3 and .wav files only
        ),
      }));

    return audioData;
  });
