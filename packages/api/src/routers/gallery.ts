import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { ORPCError, os } from "@orpc/server";
import z from "zod";
import { pathExists, rmByBasename } from "../lib/fsBaseNameFunctions";
import { generateGalleryData } from "../lib/generateGalleryData";

const galleryExistsCheck = async (name: string, id: string) => {
  if (!(await pathExists(`./media/Galleries/${name}.${id}`))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Gallery with name ${name} and ID ${id} doesn't exist`,
    });
  }
};

// Helper to attach saved tags to gallery items
const attachTagsToGalleryData = async (galleryPath: string, items: any[]) => {
  const tagsFilePath = `${galleryPath}/.tags.json`;
  if (await pathExists(tagsFilePath)) {
    try {
      const tagsData: Record<string, string[]> =
        await Bun.file(tagsFilePath).json();
      return items.map((item) => ({
        ...item,
        tags: tagsData[item.name] || item.tags || [],
      }));
    } catch {
      return items;
    }
  }
  return items;
};

export const getGalleryData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;
    const galleryPath = `./media/Galleries/${name}.${id}`;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name or ID`,
      });
    }

    await galleryExistsCheck(name, id);

    try {
      const data = await Bun.file(`${galleryPath}/.gallery-data.json`).json();
      return await attachTagsToGalleryData(galleryPath, data);
    } catch {
      const data = await generateGalleryData(`${name}.${id}`);
      const enrichedData = await attachTagsToGalleryData(galleryPath, data);
      await Bun.write(
        `${galleryPath}/.gallery-data.json`,
        JSON.stringify(enrichedData),
      );
      return enrichedData;
    }
  });

export const refreshGalleryData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;
    const galleryPath = `./media/Galleries/${name}.${id}`;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name or ID`,
      });
    }

    await galleryExistsCheck(name, id);

    const data = await generateGalleryData(`${name}.${id}`);
    const enrichedData = await attachTagsToGalleryData(galleryPath, data);
    await Bun.write(
      `${galleryPath}/.gallery-data.json`,
      JSON.stringify(enrichedData),
    );
    return enrichedData;
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
    const galleryPath = `./media/Galleries/${name}.${id}`;

    if (!name || !id || !contents.length) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name or ID or Contents`,
      });
    }

    await galleryExistsCheck(name, id);

    await Promise.all(
      contents.map((content) =>
        rm(`${galleryPath}/${content}`, {
          recursive: true,
          force: true,
        }),
      ),
    );

    const newGalleryData = await generateGalleryData(`${name}.${id}`);
    const enrichedData = await attachTagsToGalleryData(
      galleryPath,
      newGalleryData,
    );
    await Bun.write(
      `${galleryPath}/.gallery-data.json`,
      JSON.stringify(enrichedData),
    );

    return enrichedData;
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
    const galleryPath = `./media/Galleries/${name}.${id}`;

    try {
      await rmByBasename(`${galleryPath}/.gallery-covers`, `cover.${content}`);
    } catch {}

    await mkdir(`${galleryPath}/.gallery-covers`, { recursive: true });
    await Bun.write(
      `${galleryPath}/.gallery-covers/cover.${content}.${file.type.split("/")[1]}`,
      file,
    );

    const newGalleryData = await generateGalleryData(`${name}.${id}`);
    const enrichedData = await attachTagsToGalleryData(
      galleryPath,
      newGalleryData,
    );
    await Bun.write(
      `${galleryPath}/.gallery-data.json`,
      JSON.stringify(enrichedData),
    );
    return enrichedData;
  });

export const updateContentTags = os
  .input(
    z.object({
      name: z.string(),
      id: z.string(),
      content: z.string(),
      tags: z.array(z.string()),
    }),
  )
  .handler(async ({ input }) => {
    const { name, id, content, tags } = input;
    const galleryPath = `./media/Galleries/${name}.${id}`;

    if (!name || !id || !content) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Gallery Name, ID, or Content`,
      });
    }

    await galleryExistsCheck(name, id);

    const tagsFilePath = `${galleryPath}/.tags.json`;
    let tagsData: Record<string, string[]> = {};
    if (await pathExists(tagsFilePath)) {
      try {
        tagsData = await Bun.file(tagsFilePath).json();
      } catch {
        tagsData = {};
      }
    }
    tagsData[content] = tags;
    await Bun.write(tagsFilePath, JSON.stringify(tagsData, null, 2));

    const galleryDataPath = `${galleryPath}/.gallery-data.json`;
    let galleryData = [];
    if (await pathExists(galleryDataPath)) {
      try {
        galleryData = await Bun.file(galleryDataPath).json();
      } catch {
        galleryData = await generateGalleryData(`${name}.${id}`);
      }
    } else {
      galleryData = await generateGalleryData(`${name}.${id}`);
    }

    const updatedData = galleryData.map((item: any) => ({
      ...item,
      tags:
        item.name === content ? tags : tagsData[item.name] || item.tags || [],
    }));

    await Bun.write(galleryDataPath, JSON.stringify(updatedData, null, 2));
    return updatedData;
  });

export const renameGalleryContent = os
  .input(
    z.object({
      name: z.string(),
      id: z.string(),
      oldContentName: z.string(),
      newBaseName: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { name, id, oldContentName, newBaseName } = input;
    const galleryPath = `./media/Galleries/${name}.${id}`;

    if (!name || !id || !oldContentName || !newBaseName) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: "Missing required parameters",
      });
    }

    await galleryExistsCheck(name, id);

    // Validate characters in file base name
    const invalidCharsRegex = /[/\\?%*:|"<>]/;
    const trimmedBase = newBaseName.trim();
    if (!trimmedBase || invalidCharsRegex.test(trimmedBase)) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message:
          'Invalid filename. Avoid special characters like / \\ ? * : | " < >',
      });
    }

    // Preserve original file extension
    const ext = path.extname(oldContentName);
    const newContentName = `${trimmedBase}${ext}`;

    const oldFilePath = `${galleryPath}/${oldContentName}`;
    const newFilePath = `${galleryPath}/${newContentName}`;

    if (!(await pathExists(oldFilePath))) {
      throw new ORPCError("NOT_FOUND", {
        message: `File ${oldContentName} does not exist.`,
      });
    }

    // Check for conflict if name actually changed
    if (oldContentName !== newContentName && (await pathExists(newFilePath))) {
      throw new ORPCError("CONFLICT", {
        message: `A file named "${newContentName}" already exists in this gallery.`,
      });
    }

    if (oldContentName !== newContentName) {
      // 1. Rename physical file
      await rename(oldFilePath, newFilePath);

      // 2. Rename associated cover file if present
      const coverDir = `${galleryPath}/.gallery-covers`;
      if (await pathExists(coverDir)) {
        try {
          const coverFiles = await readdir(coverDir);
          for (const file of coverFiles) {
            if (file.startsWith(`cover.${oldContentName}`)) {
              const newCoverFile = file.replace(
                `cover.${oldContentName}`,
                `cover.${newContentName}`,
              );
              await rename(
                `${coverDir}/${file}`,
                `${coverDir}/${newCoverFile}`,
              );
            }
          }
        } catch {}
      }

      // 3. Update tags.json key mapping
      const tagsFilePath = `${galleryPath}/.tags.json`;
      if (await pathExists(tagsFilePath)) {
        try {
          const tagsData: Record<string, string[]> =
            await Bun.file(tagsFilePath).json();
          if (tagsData[oldContentName]) {
            tagsData[newContentName] = tagsData[oldContentName];
            delete tagsData[oldContentName];
            await Bun.write(tagsFilePath, JSON.stringify(tagsData, null, 2));
          }
        } catch {}
      }
    }

    // 4. Regenerate gallery data to reflect rename
    const newGalleryData = await generateGalleryData(`${name}.${id}`);
    const enrichedData = await attachTagsToGalleryData(
      galleryPath,
      newGalleryData,
    );
    await Bun.write(
      `${galleryPath}/.gallery-data.json`,
      JSON.stringify(enrichedData),
    );

    return { galleryData: enrichedData, newName: newContentName };
  });
