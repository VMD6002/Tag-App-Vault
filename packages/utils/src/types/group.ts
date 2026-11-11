import z from "zod";

// Contract shipped by TagApp 6.0 (its `POST /downloads/set` carries these records).
export const GroupSchema = z.object({
  id: z.string(), // grp_<nanoid10>
  title: z.string(),
  extraData: z.string(), // markdown description
  tags: z.array(z.string()),
  cover: z.string().optional(), // plain URL; empty: fall back to a child's cover
  added: z.number(), // seconds
  lastUpdated: z.number(), // seconds
});
export type GroupType = z.infer<typeof GroupSchema>;
/** `DB/groups.json`. */
export type GroupsDB = Record<string, GroupType>;

export const GroupCreateSchema = GroupSchema.omit({
  added: true,
  lastUpdated: true,
});
export const GroupUpdateSchema = GroupCreateSchema.partial().required({
  id: true,
});
export const GroupItemsSchema = z.object({
  id: z.string(),
  itemIds: z.string().array(),
});
export const GroupDeleteSchema = z.object({
  id: z.string(),
  deleteIds: z.string().array(), // shared items to delete too; other shared items just lose the group
});
export const GroupFixSchema = z.object({ id: z.string().optional() }); // no id: every group
export const GroupMergeSchema = z.object({
  ids: z.string().array(),
  keepId: z.string(),
});
export const GroupChangeIdSchema = z.object({
  oldId: z.string(),
  newId: z.string(),
});

export type GroupCreateType = z.infer<typeof GroupCreateSchema>;
export type GroupUpdateType = z.infer<typeof GroupUpdateSchema>;
export type GroupItemsType = z.infer<typeof GroupItemsSchema>;
export type GroupDeleteType = z.infer<typeof GroupDeleteSchema>;
export type GroupFixType = z.infer<typeof GroupFixSchema>;
export type GroupMergeType = z.infer<typeof GroupMergeSchema>;
export type GroupChangeIdType = z.infer<typeof GroupChangeIdSchema>;

/** Library sort position of a group card. */
export const GroupSortSchema = z.enum(["newestChild", "created", "updated"]);
export type GroupSortType = z.infer<typeof GroupSortSchema>;
