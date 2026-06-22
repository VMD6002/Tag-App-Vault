import { ContentServerType } from "@tagapp/utils/types";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

export type contentDataDBType = Record<string, ContentServerType>;

const contentDataDB_DefaultData: contentDataDBType = {};

export const contentDataDB: Low<contentDataDBType> = await JSONFilePreset(
  "./DB/contentData.json",
  contentDataDB_DefaultData,
);
