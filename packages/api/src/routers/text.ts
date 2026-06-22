import { ORPCError, os } from "@orpc/server";
import { pathExists, readJSON, writeJSON } from "fs-extra";
import z from "zod";
import { rm, writeFile } from "node:fs/promises";
import { generateTxtData } from "../lib/generateTextData";

const txtExistsCheck = async (name: string, id: string) => {
  if (!(await pathExists(`./media/Texts/${name}.${id}`))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Text with name ${name} and ID ${id} doesn't exist`,
    });
  }
};

export const getTxtData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Txt Name or ID`,
      });
    }

    await txtExistsCheck(name, id);

    try {
      const data: Awaited<ReturnType<typeof generateTxtData>> = await readJSON(
        `./media/Texts/${name}.${id}/txt-data.json`,
      );
      return data;
    } catch {
      const data = await generateTxtData(`${name}.${id}`);
      await writeJSON(`./media/Texts/${name}.${id}/txt-data.json`, data);
      return data;
    }
  });

export const setTxt = os
  .input(
    z.object({
      name: z.string(),
      id: z.string(),
      txtName: z.string(),
      txtContent: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { name, id, txtName, txtContent } = input;

    if (!name || !id || !txtName) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Txt Name or ID or TxtName`,
      });
    }

    await txtExistsCheck(name, id);

    await writeFile(`./media/Texts/${name}.${id}/${txtName}`, txtContent);
    return input;
  });

export const refreshTxtData = os
  .input(z.object({ name: z.string(), id: z.string() }))
  .handler(async ({ input }) => {
    const { name, id } = input;

    if (!name || !id) {
      throw new ORPCError("NOT_ACCEPTABLE", {
        message: `Blank Txt Name or ID`,
      });
    }

    await txtExistsCheck(name, id);

    const data = await generateTxtData(`${name}.${id}`);
    await writeJSON(`./media/Texts/${name}.${id}/txt-data.json`, data);
    return data;
  });

export const removeTxtContents = os
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
        message: `Blank Txt Name or ID or Contents`,
      });
    }

    await txtExistsCheck(name, id);

    await Promise.all(
      contents.map((content) =>
        rm(`./media/Texts/${name}.${id}/${content}`, {
          recursive: true,
          force: true,
        }),
      ),
    );

    return contents;
  });
