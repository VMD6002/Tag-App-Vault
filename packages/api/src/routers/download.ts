import { os } from "@orpc/server";
import { contentWebSchema } from "@tagapp/utils/types";
import { JSONFilePreset } from "lowdb/node";
import z from "zod";

const dataValidator = z.array(contentWebSchema);

export const set = os.input(dataValidator).handler(async ({ input }) => {
  const defaultData: typeof input = [];
  const db = await JSONFilePreset("./Download/tmp.json", defaultData);
  db.data = input;
  await db.write();
});
