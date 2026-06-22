import z from "zod";
import { ContentJsonSchema } from "./shared";

export const CtypeSchema = z.enum(["img", "video", "gallery", "audio", "txt"]);
export type CType = z.infer<typeof CtypeSchema>;

export const contentServerSchema = ContentJsonSchema.extend({
  type: CtypeSchema,
});
export type ContentServerType = z.infer<typeof contentServerSchema>;

export type ContentServerDataType = Record<string, ContentServerType>;
