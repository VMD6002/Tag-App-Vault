import { afterAll, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Paths are cwd-relative and the DB loads on import, so move to a scratch root first.
const root = mkdtempSync(join(tmpdir(), "tagapp-sync-"));
process.chdir(root);
mkdirSync("DB");
const { contentDataDB } = await import("../db/contentData.js");
const { tagDB } = await import("../db/tags.js");
const { getSyncData } = await import("./getSyncData.js");
const { syncContent } = await import("./syncContent.js");
const { setDoc } = await import("./setDoc.js");
const { deleteData } = await import("./deleteData.js");

// A 1x1 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);
const json = (id: string, title: string, tags: string[] = []) =>
  JSON.stringify({ id, title, tags, extraData: "", added: 1, lastUpdated: 1 });
const ls = (dir: string) => readdirSync(dir).sort();

beforeEach(() => {
  for (const dir of ["Sync", "UnSyncable", "media"]) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync("Sync");
  mkdirSync("UnSyncable");
  for (const dir of [
    "Images/.covers",
    "Videos/.covers",
    "Videos/.captions",
    "Galleries",
    "Audios",
    "Texts",
  ]) {
    mkdirSync(`media/${dir}`, { recursive: true });
  }
  contentDataDB.data = {};
  tagDB.data = {};
});
afterAll(() => {
  process.chdir(tmpdir());
  rmSync(root, { recursive: true, force: true });
});

test("getSyncData writes nothing", async () => {
  await Bun.write("Sync/a.png", png);
  await Bun.write("Sync/b.xyz", "x");
  await Bun.write(
    "Sync/tdata.1.json",
    JSON.stringify([JSON.parse(json("9", "c"))]),
  );
  const before = ls("Sync");
  const { contents, unsyncable } = await getSyncData();
  expect(ls("Sync")).toEqual(before);
  expect(ls("UnSyncable")).toEqual([]);
  expect(unsyncable).toEqual(["b.xyz"]);
  expect(Object.values(contents).map((c) => c.title)).toEqual(["a"]);
});

test("B1: audio cover is one string, naturally sorted, or absent", async () => {
  mkdirSync("Sync/one.1.audio/.audio-covers", { recursive: true });
  await Bun.write("Sync/one.1.audio/.audio-covers/img10.png", png);
  await Bun.write("Sync/one.1.audio/.audio-covers/img2.png", png);
  mkdirSync("Sync/none.2.audio");
  await Bun.write("Sync/one.1.json", json("1", "one"));
  await Bun.write("Sync/none.2.json", json("2", "none"));
  await syncContent();
  expect(contentDataDB.data["1"]?.cover).toBe("img2.png");
  expect(contentDataDB.data["2"]?.cover).toBeUndefined();
});

test("B2: an existing id changes nothing and stays in Sync", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "a", ["x"]));
  await syncContent();

  await Bun.write("Sync/a.1.png", "new bytes");
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "changed.a", ["x"]));
  await syncContent();

  expect(tagDB.data).toEqual({ x: 1 });
  expect(contentDataDB.data["1"]?.title).toBe("a");
  expect(await Bun.file("media/Images/a.1.png").bytes()).toEqual(
    new Uint8Array(png),
  );
  expect(ls("Sync")).toEqual(["a.1.json", "a.1.png", "cover.a.1.png"]);
});

test("B2: a repeated id inside one scan keeps one item", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/a.1.webp", png);
  await Bun.write("Sync/a.1.json", json("1", "a", ["x"]));
  await syncContent();
  expect(tagDB.data).toEqual({ x: 1 });
  expect(ls("media/Images").filter((f) => !f.startsWith("."))).toHaveLength(1);
  expect(ls("UnSyncable")).toEqual([]);
});

test("B4: concurrent syncs behave like one", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "a", ["x"]));
  await Promise.all([syncContent(), syncContent()]);
  expect(tagDB.data).toEqual({ x: 1 });
  expect(ls("Sync")).toEqual([]);
  expect(ls("UnSyncable")).toEqual([]);
});

test("B6: a failed DB write keeps the item in Sync, sidecar included", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "a", ["x"]));
  const write = tagDB.write;
  tagDB.write = () => Promise.reject(new Error("disk full"));
  await syncContent();
  tagDB.write = write;
  expect(ls("Sync")).toEqual(["a.1.json", "a.1.png", "cover.a.1.png"]);
  expect(contentDataDB.data["1"]).toBeUndefined();
  expect(tagDB.data).toEqual({});
});

test("B8: a non-image cover is rejected and duplicates resolve the same way", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/cover.a.1.jpg", png);
  await Bun.write("Sync/cover.a.1.mp4", "x");
  await Bun.write("Sync/a.1.json", json("1", "a"));
  await syncContent();
  expect(ls("media/Images/.covers")).toEqual(["cover.a.1.jpg"]);
  expect(ls("UnSyncable")).toEqual(["cover.a.1.mp4", "cover.a.1.png"]);
});

test("B10: tags are trimmed, deduplicated and counted once", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "a", ["a", "a", " a", ""]));
  await syncContent();
  expect(contentDataDB.data["1"]?.tags).toEqual(["a"]);
  expect(tagDB.data).toEqual({ a: 1 });
});

test("B11: images get a generated webp cover, videos may have none", async () => {
  await Bun.write("Sync/pic.png", png);
  await Bun.write("Sync/clip.mp4", "x");
  mkdirSync("Sync/empty.3.gallery");
  await Bun.write("Sync/empty.3.json", json("3", "empty"));
  await syncContent();

  const covers = ls("media/Images/.covers");
  expect(covers).toHaveLength(1);
  expect(covers[0]).toEndWith(".webp");
  expect(
    (await new Bun.Image(`media/Images/.covers/${covers[0]}`).metadata())
      .format,
  ).toBe("webp");
  expect(ls("media/Videos/.covers")).toEqual([]);
  expect(ls("media/Videos").filter((f) => !f.startsWith("."))).toHaveLength(1);
  expect(ls("Sync")).toEqual([]);
  expect(contentDataDB.data["3"]?.cover).toBeUndefined();
  expect(
    Object.values(contentDataDB.data).some(
      (c) => (c.cover as unknown) === null,
    ),
  ).toBe(false);
});

test("B11: an image that can't be decoded goes to UnSyncable", async () => {
  await Bun.write("Sync/a.1.svg", "<svg/>");
  await syncContent();
  expect(ls("UnSyncable")).toEqual(["a.1.svg"]);
  expect(contentDataDB.data).toEqual({});
});

test("B12: an orphan JSON is reported and left alone", async () => {
  await Bun.write("Sync/lost.1.json", json("1", "lost"));
  const { orphanJsons } = await getSyncData();
  expect(orphanJsons).toEqual(["lost.1.json"]);
  await syncContent();
  expect(await Bun.file("Sync/lost.1.json").exists()).toBe(true);
});

test("B11: a video with no cover can be renamed and deleted", async () => {
  await Bun.write("Sync/clip.1.mp4", "x");
  await Bun.write("Sync/clip.1.json", json("1", "clip"));
  await syncContent();

  await setDoc({ id: "1", title: "renamed", tags: [], extraData: "" });
  expect(await Bun.file("media/Videos/renamed.1.mp4").exists()).toBe(true);

  expect(await deleteData(["1"])).toEqual(["1"]);
  expect(ls("media/Videos").filter((f) => !f.startsWith("."))).toEqual([]);
});
