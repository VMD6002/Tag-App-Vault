import { ORPCError, os } from "@orpc/server";
import {
  addGroupItems,
  changeGroupId,
  createGroup,
  disbandGroup,
  fixGroups,
  mergeGroups,
  newGroupId,
  removeGroupItems,
  updateGroup,
} from "@tagapp/utils";
import {
  GroupChangeIdSchema,
  GroupCreateSchema,
  GroupDeleteSchema,
  GroupFixSchema,
  GroupItemsSchema,
  GroupMergeSchema,
  GroupUpdateSchema,
} from "@tagapp/utils/types";
import z from "zod";
import { groupsDB } from "../db/groups.js";
import {
  deleteGroupWithItems,
  planGroupDelete,
  runGroupOp,
} from "../services/groups.js";

/** Every group record, empty ones included. The client computes children and runs `filterLibrary`. */
export const list = os.handler(async () => groupsDB.data);

export const get = os
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const group = groupsDB.data[input.id];
    if (!group) throw new ORPCError("NOT_FOUND");
    return group;
  });

/** `id` defaults to a new `grp_<10 chars>`. */
export const create = os
  .input(GroupCreateSchema.partial({ id: true, extraData: true, tags: true }))
  .handler(({ input }) =>
    runGroupOp((s, now) =>
      createGroup(
        s,
        {
          ...input,
          id: input.id ?? newGroupId(),
          extraData: input.extraData ?? "",
          tags: input.tags ?? [],
        },
        now,
      ),
    ),
  );

/** `cover: ""` clears the cover. */
export const update = os
  .input(GroupUpdateSchema)
  .handler(({ input }) => runGroupOp((s, now) => updateGroup(s, input, now)));

export const addItems = os
  .input(GroupItemsSchema)
  .handler(({ input }) =>
    runGroupOp((s, now) => addGroupItems(s, input, now), { content: true }),
  );

export const removeItems = os
  .input(GroupItemsSchema)
  .handler(({ input }) =>
    runGroupOp((s, now) => removeGroupItems(s, input, now), { content: true }),
  );

/** Drops the group record and its id from every child; the items stay. */
export const disband = os
  .input(GroupDeleteSchema.pick({ id: true }))
  .handler(({ input }) =>
    runGroupOp((s, now) => disbandGroup(s, input, now), { content: true }),
  );

/** `{ exclusive, shared }`: children only in this group, and children that are also in other groups. */
export const planDelete = os
  .input(GroupDeleteSchema.pick({ id: true }))
  .handler(({ input }) => planGroupDelete(input.id));

// `delete` is a reserved word, hence the aliased export below.
const remove = os
  .input(GroupDeleteSchema)
  .handler(({ input }) => deleteGroupWithItems(input));

export { remove as delete };

/** Recreates missing records for ids found on items and clears empty-string covers; `id` limits it to one group. */
export const fix = os
  .input(GroupFixSchema)
  .handler(({ input }) => runGroupOp((s, now) => fixGroups(s, input, now)));

export const merge = os
  .input(GroupMergeSchema)
  .handler(({ input }) =>
    runGroupOp((s, now) => mergeGroups(s, input, now), { content: true }),
  );

/** An existing `newId` means merge into it. */
export const changeId = os
  .input(GroupChangeIdSchema)
  .handler(({ input }) =>
    runGroupOp((s, now) => changeGroupId(s, input, now), { content: true }),
  );
