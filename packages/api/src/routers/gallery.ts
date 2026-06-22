import { ORPCError, os } from "@orpc/server";
import { pathExists, readJSON, writeJSON } from "fs-extra";
import z from "zod";
import { generateGalleryData } from "../lib/generateGalleryData";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { rmByBasename } from "../lib/fsBaseNameFunctions";

const galleryExistsCheck = async (name: string, id: string) => {
  if (!(await pathExists(`./media/Galleries/${name}.${id}`))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Gallery with name ${name} and ID ${id} doesn't exist`,
    });
  }
};

export const getGalleryData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name or ID`,
      });
    }

    await galleryExistsCheck(name, id);

    try {
      const data: Awaited<ReturnType<typeof generateGalleryData>> =
        await readJSON(`./media/Galleries/${name}.${id}/gallery-data.json`);
      return data;
    } catch {
      const data = await generateGalleryData(`${name}.${id}`);
      await writeJSON(
        `./media/Galleries/${name}.${id}/gallery-data.json`,
        data,
      );
      return data;
    }
  });

export const refreshGalleryData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name or ID`,
      });
    }

    await galleryExistsCheck(name, id);

    const data = await generateGalleryData(`${name}.${id}`);
    await writeJSON(`./media/Galleries/${name}.${id}/gallery-data.json`, data);
    return data;
  });

export const removeGalleryContents = os
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
        message: `Blank Gallery Name or ID or Contents`,
      });
    }

    await galleryExistsCheck(name, id);

    await Promise.all(
      contents.map((content) =>
        rm(`./media/Galleries/${name}.${id}/${content}`, {
          recursive: true,
          force: true,
        }),
      ),
    );

    const newGalleryData = await generateGalleryData(`${name}.${id}`);
    await writeJSON(
      `./media/Galleries/${name}.${id}/gallery-data.json`,
      newGalleryData,
    );

    return newGalleryData;
  });

export const setCoverGivenFile = os
  .input(
    z.object({
      id: z.string(),
      name: z.string(),
      content: z.string(),
      file: z.instanceof(File),
    }),
  )
  .handler(async ({ input }) => {
    const { id, name, content, file } = input;
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await rmByBasename(
        `./media/Galleries/${name}.${id}/.gallery-covers`,
        `cover.${content}`,
      );
    } catch {}
    await mkdir(`./media/Galleries/${name}.${id}/.gallery-covers`, {
      recursive: true,
    });
    await writeFile(
      `./media/Galleries/${name}.${id}/.gallery-covers/cover.${content}.${file.type.split("/")[1]}`,
      buffer,
    );

    const newGalleryData = await generateGalleryData(`${name}.${id}`);
    await writeJSON(
      `./media/Galleries/${name}.${id}/gallery-data.json`,
      newGalleryData,
    );
    return newGalleryData;
  });
