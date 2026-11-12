import { afterAll, beforeEach, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Paths are cwd-relative, so move to a scratch root first.
const root = mkdtempSync(join(tmpdir(), "tagapp-gallery-"));
process.chdir(root);
const { call } = await import("@orpc/server");
const { bulkUpdateContentTags, updateContentTags } = await import(
  "./gallery.js"
);

const dir = "media/Galleries/G.g1";
const tagsPath = `${dir}/.tags.json`;
const readTags = () => JSON.parse(readFileSync(tagsPath, "utf8"));
const bulk = (contents: string[], add: string[], remove: string[]) =>
  call(bulkUpdateContentTags, { name: "G", id: "g1", contents, add, remove });

afterAll(() => {
  process.chdir(tmpdir());
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync("media", { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of ["a.png", "b.png", "c.png"])
    writeFileSync(`${dir}/${f}`, "x");
});

test("adds and removes tags on the selected files only, in one write", async () => {
  await call(updateContentTags, {
    name: "G",
    id: "g1",
    content: "a.png",
    tags: ["x", "keep"],
  });
  await call(updateContentTags, {
    name: "G",
    id: "g1",
    content: "c.png",
    tags: ["x"],
  });

  const res = await bulk(["a.png", "b.png"], ["new", "keep"], ["x"]);
  const byName = Object.fromEntries(res.map((e) => [e.name, e.tags]));
  expect(byName).toEqual({
    "a.png": ["keep", "new"],
    "b.png": ["new", "keep"],
    "c.png": ["x"],
  });
  expect(readTags()).toEqual(byName);
  // the cache returned next time matches
  expect(
    JSON.parse(readFileSync(`${dir}/.gallery-data.json`, "utf8")).map(
      (e: { tags: string[] }) => e.tags,
    ),
  ).toEqual(res.map((e) => e.tags));
});

test("a tag in both add and remove ends up added", async () => {
  const res = await bulk(["a.png"], ["t"], ["t"]);
  expect(res.find((e) => e.name === "a.png")?.tags).toEqual(["t"]);
});

test("an unknown file rejects the whole call and writes nothing", async () => {
  await expect(bulk(["a.png", "nope.png"], ["t"], [])).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(bulk(["../outside"], ["t"], [])).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(() => readTags()).toThrow();
});

test("empty selection and unknown gallery are rejected", async () => {
  await expect(bulk([], ["t"], [])).rejects.toMatchObject({
    code: "NOT_ACCEPTABLE",
  });
  await expect(
    call(bulkUpdateContentTags, {
      name: "X",
      id: "nope",
      contents: ["a"],
      add: [],
      remove: [],
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("a failed cache write restores .tags.json", async () => {
  writeFileSync(tagsPath, JSON.stringify({ "a.png": ["old"] }));
  // a directory where the cache file goes makes that write fail after .tags.json was written
  mkdirSync(`${dir}/.gallery-data.json`);
  await expect(bulk(["a.png"], ["t"], [])).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(readTags()).toEqual({ "a.png": ["old"] });
});
