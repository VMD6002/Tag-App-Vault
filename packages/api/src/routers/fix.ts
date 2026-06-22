import { contentDataDB } from "../db/contentData.js";
import { tagDB } from "../db/tags.js";
import { os } from "@orpc/server";

export const hardResetTagCount = os.handler(async () => {
  tagDB.data = {};
  for (const id in contentDataDB.data) {
    contentDataDB.data[id]!.tags.forEach(
      (tag) => (tagDB.data[tag] = (tagDB.data[tag] ?? 0) + 1),
    );
  }
  await tagDB.write();
  console.log("Server Tag Count Fixed");
  return tagDB.data;
});

export const softResetTagCount = os.handler(async () => {
  for (const tag in tagDB.data) {
    if (!tagDB.data[tag]) delete tagDB.data[tag];
  }
  console.log("Tag with zero count removed");
  return tagDB.data;
});
