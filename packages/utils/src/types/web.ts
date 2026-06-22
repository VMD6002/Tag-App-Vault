import { ContentJsonSchema } from "./shared";
import z from "zod";

export const presetSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type preset = z.infer<typeof presetSchema>;

const ContentDownloadSchema = z.object({
  type: z.string(),
  flags: presetSchema.optional(),
});
export type ContentDownload = z.infer<typeof ContentDownloadSchema>;

export const contentWebSchema = ContentJsonSchema.extend({
  url: z.string(),
  scraper: z.string(),
  download: ContentDownloadSchema.optional(),
  contentUrl: z.string().optional(),
});
export type ContentWebType = z.infer<typeof contentWebSchema>;

export type ContentWebDataType = Record<string, ContentWebType>;
