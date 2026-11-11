import type { GroupsDB } from "@tagapp/utils/types";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

const groupsDB_DefaultData: GroupsDB = {};

/** `DB/groups.json`: `Record<id, GroupType>`. The server writes it once at startup so it always exists. */
export const groupsDB: Low<GroupsDB> = await JSONFilePreset(
  "./DB/groups.json",
  groupsDB_DefaultData,
);
