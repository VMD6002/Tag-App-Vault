import { os } from "@orpc/server";
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
    try {
      await rmByBasename("./media/Videos/.covers", `cover.${name}.${id}`);
    } catch {}
    await Bun.write(
      `./media/Videos/.covers/cover.${name}.${id}.${file.type.split("/")[1]}`,
      file,
    );
    return { id, name };
  });
