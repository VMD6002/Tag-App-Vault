import { z } from "zod";

// Define the Schema
export const ContentJsonSchema = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  extraData: z.string(),
  cover: z.string().optional(),
  // Unix Timestamps
  added: z.number(),
  lastUpdated: z.number(),
});

// Automatically generate the Type from the Schema
export type ContentJsonType = z.infer<typeof ContentJsonSchema>;
