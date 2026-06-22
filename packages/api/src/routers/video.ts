import { os } from "@orpc/server";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { rmByBasename } from "../lib/fsBaseNameFunctions";

export const setCoverGivenFile = os
  .input(
    z.object({
      id: z.string(),
      name: z.string(),
      file: z.instanceof(File),
    }),
  )
  .handler(async ({ input }) => {
    const { id, name, file } = input;
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await rmByBasename("./media/Videos/.covers", `cover.${name}.${id}`);
    } catch (error) {}
    await writeFile(
      `./media/Videos/.covers/cover.${name}.${id}.${file.type.split("/")[1]}`,
      buffer,
    );
    return { id, name };
  });
