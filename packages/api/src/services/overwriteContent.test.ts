import { afterAll, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Paths are cwd-relative and the DBs load on import, so move to a scratch root first.
const root = mkdtempSync(join(tmpdir(), "tagapp-overwrite-"));
process.chdir(root);
mkdirSync("DB");
const { contentDataDB } = await import("../db/contentData.js");
const { tagDB } = await import("../db/tags.js");
const { overwriteContent, contentSyncSchema } = await import(
  "./overwriteContent.js"
);

type Item = (typeof contentDataDB.data)[string];
const item = (id: string, tags: string[] = [], title = `T${id}`): Item => ({
  id,
  title,
  tags,
  extraData: "old",
  added: 1,
  lastUpdated: 1,
  type: "txt",
});
const seed = (items: Item[]) => {
  contentDataDB.data = Object.fromEntries(items.map((i) => [i.id, i]));
  const c: Record<string, number> = {};
  for (const t of items.flatMap((i) => i.tags)) c[t] = (c[t] ?? 0) + 1;
  tagDB.data = c;
  for (const i of items)
    mkdirSync(`media/Texts/${i.title}.${i.id}`, { recursive: true });
};
const recount = () => {
  const c: Record<string, number> = {};
  for (const t of Object.values(contentDataDB.data).flatMap((i) => i.tags))
    c[t] = (c[t] ?? 0) + 1;
  return c;
};
const sync = (
  ...items: { id: string; title: string; tags: string[]; extraData: string }[]
) => overwriteContent(contentSyncSchema.parse({ items }));

beforeEach(() => {
  rmSync("media", { recursive: true, force: true });
  mkdirSync("media/Texts", { recursive: true });
  seed([]);
});
afterAll(() => {
  process.chdir(tmpdir());
  rmSync(root, { recursive: true, force: true });
});

test("title is renamed on disk, tags replaced with counts fixed, extraData overwritten", async () => {
  seed([item("1", ["a", "b"]), item("2", ["b"])]);
  const res = await sync({
    id: "1",
    title: "New: title",
    tags: ["b", "c"],
    extraData: "fresh",
  });
  expect(res).toEqual({ updated: ["1"], missing: [], failed: [] });
  expect(contentDataDB.data["1"]).toMatchObject({
    title: "New_ title",
    tags: ["b", "c"],
    extraData: "fresh",
  });
  expect(existsSync("media/Texts/New_ title.1")).toBe(true);
  expect(existsSync("media/Texts/T1.1")).toBe(false);
  expect(tagDB.data).toEqual({ b: 2, c: 1 });
  expect(tagDB.data).toEqual(recount());
});

test("missing ids are reported and the rest still runs", async () => {
  seed([item("1")]);
  const res = await sync(
    { id: "nope", title: "x", tags: [], extraData: "" },
    { id: "1", title: "T1", tags: ["t"], extraData: "old" },
  );
  expect(res).toEqual({ updated: ["1"], missing: ["nope"], failed: [] });
  expect(tagDB.data).toEqual({ t: 1 });
});

test("an unchanged item is left alone (no rename, no write)", async () => {
  seed([item("1", ["a", "b"])]);
  const before = contentDataDB.data["1"];
  const res = await sync({
    id: "1",
    title: "T1",
    tags: ["b", "a"],
    extraData: "old",
  });
  expect(res).toEqual({ updated: [], missing: [], failed: [] });
  expect(contentDataDB.data["1"]).toBe(before);
});

test("a failing item is reported, the others go on, and its data stays", async () => {
  seed([item("1", ["a"]), item("2", ["a"])]);
  // the folder is gone: the rename of 1 throws
  rmSync("media/Texts/T1.1", { recursive: true });
  const res = await sync(
    { id: "1", title: "Other", tags: ["z"], extraData: "" },
    { id: "2", title: "T2", tags: ["z"], extraData: "" },
    { id: "3", title: "", tags: [], extraData: "" },
  );
  expect(res.updated).toEqual(["2"]);
  expect(res.missing).toEqual(["3"]);
  expect(res.failed.map((f) => f.id)).toEqual(["1"]);
  expect(contentDataDB.data["1"]).toMatchObject({ title: "T1", tags: ["a"] });
  expect(tagDB.data).toEqual(recount());
});

test("an empty title fails without touching the item", async () => {
  seed([item("1", ["a"])]);
  const res = await sync({ id: "1", title: " ", tags: [], extraData: "" });
  expect(res.failed).toEqual([{ id: "1", error: "Title is empty" }]);
  expect(contentDataDB.data["1"]?.tags).toEqual(["a"]);
});

test("reserved tags the Vault has survive; meta:caption is never added from outside", async () => {
  seed([item("1", ["a", "view:list", "meta:caption"]), item("2", ["a"])]);
  const res = await sync(
    { id: "1", title: "T1", tags: ["b"], extraData: "old" },
    {
      id: "2",
      title: "T2",
      tags: ["b", "meta:caption", "view:grid-2"],
      extraData: "old",
    },
  );
  expect(res.updated).toEqual(["1", "2"]);
  expect(contentDataDB.data["1"]?.tags.sort()).toEqual(
    ["b", "meta:caption", "view:list"].sort(),
  );
  // other reserved tags may come from the extension
  expect(contentDataDB.data["2"]?.tags).toEqual(["b", "view:grid-2"]);
  expect(tagDB.data).toEqual(recount());
});
