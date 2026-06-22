import errorLog from "../lib/errorLog.js";
import { JSONFilePreset } from "lowdb/node";
import z from "zod";

const tagDBValidator = z.record(z.string(), z.number().min(0));
type tagDB = z.infer<typeof tagDBValidator>;
const tagDB_DefaultData: tagDB = {};
const tagDB = await JSONFilePreset("./DB/tags.json", tagDB_DefaultData);

const DecrementTagCount = (tags: string[] | Set<string>) => {
  try {
    const tagsArray = Array.from(tags);
    tagsArray.forEach((tag) => {
      if (isNaN(tagDB.data[tag]!)) {
        console.log(`Tag "${tag}" not found. No update performed.`);
        return;
      }
      const newCount = tagDB.data[tag]! - 1;
      if (newCount < 1) {
        delete tagDB.data[tag];
        console.log(`Decrement: Deleted tag ${tag}`);
        return;
      }
      tagDB.data[tag] = newCount;
      console.log(`Decrement: New Count = ${newCount}, Tag = ${tag}`);
    });
    tagsArray.length && console.log("All tag decrement operations completed.");
  } catch (batchError) {
    errorLog(batchError);
  }
};

const IncrementTagCount = (tags: string[] | Set<string>) => {
  try {
    const tagsArray = Array.from(tags);
    tagsArray.forEach((tag) => {
      const newCount = (tagDB.data[tag] ?? 0) + 1;
      tagDB.data[tag] = newCount;
      console.log(`Increment: New Count = ${newCount}, Tag = ${tag}`);
    });
    tagsArray.length && console.log("All tag decrement operations completed.");
  } catch (batchError) {
    errorLog(batchError);
  }
};
export { tagDB, IncrementTagCount, DecrementTagCount };
