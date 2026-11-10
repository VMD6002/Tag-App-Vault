import { afterAll, beforeEach, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

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
const { editSyncItem, removeSyncItem } = await import("./syncItem.js");
const {
  startDownloads,
  setQueue,
  readQueue,
  getDownloadsSnapshot,
  watchDownloads,
} = await import("./downloads.js");
const { call } = await import("@orpc/server");
const { bulkUpdateContentTags } = await import("../routers/main.js");

// A 1x1 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);
const json = (id: string, title: string, tags: string[] = []) =>
  JSON.stringify({ id, title, tags, extraData: "", added: 1, lastUpdated: 1 });
const ls = (dir: string) => readdirSync(dir).sort();

beforeEach(() => {
  for (const dir of ["Sync", "UnSyncable", "media", "Download"]) {
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

test("bulkUpdateContentTags counts only real changes", async () => {
  const item = (id: string, tags: string[]) => ({
    id,
    title: id,
    tags,
    extraData: "",
    added: 1,
    lastUpdated: 1,
    type: "img" as const,
  });
  contentDataDB.data = {
    "1": item("1", ["keep", "gone"]),
    "2": item("2", ["keep"]),
  };
  tagDB.data = { keep: 2, gone: 1 };

  // "keep" is already on both, "gone" is on item 1 only, "never" is on neither
  await call(bulkUpdateContentTags, {
    ids: ["1", "2"],
    added: ["keep", "new"],
    removed: ["gone", "never"],
  });
  expect(contentDataDB.data["1"]?.tags).toEqual(["keep", "new"]);
  expect(contentDataDB.data["2"]?.tags).toEqual(["keep", "new"]);
  expect(tagDB.data).toEqual({ keep: 2, new: 2 });

  // a bad id changes nothing, not even the items listed before it
  await expect(
    call(bulkUpdateContentTags, {
      ids: ["1", "nope"],
      added: [],
      removed: ["keep"],
    }),
  ).rejects.toThrow();
  expect(contentDataDB.data["1"]?.tags).toEqual(["keep", "new"]);
  expect(tagDB.data).toEqual({ keep: 2, new: 2 });
});

test("an item with invalid or unreadable JSON stays in Sync with its JSON", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/a.1.json", JSON.stringify({ id: "1" }));
  await Bun.write("Sync/b.2.png", png);
  await Bun.write("Sync/b.2.json", "{ not json");
  const { orphanJsons } = await getSyncData();
  expect(orphanJsons).toEqual([]);
  await syncContent();
  expect(ls("Sync")).toEqual(["a.1.json", "a.1.png", "b.2.json", "b.2.png"]);
  expect(ls("UnSyncable")).toEqual([]);
  expect(contentDataDB.data).toEqual({});
});

test("mkv syncs as a video", async () => {
  await Bun.write("Sync/clip.1.mkv", "x");
  await Bun.write("Sync/clip.1.json", json("1", "clip"));
  await syncContent();
  expect(contentDataDB.data["1"]?.type).toBe("video");
  expect(await Bun.file("media/Videos/clip.1.mkv").exists()).toBe(true);
});

test("edit: a plain sidecar is overwritten and sync renames to the new title", async () => {
  await Bun.write("Sync/old.1.png", png);
  await Bun.write("Sync/old.1.json", json("1", "old", ["x"]));
  await editSyncItem({
    name: "old.1",
    type: "img",
    title: "a/b",
    tags: [" t ", "y", "y"],
    extraData: "notes",
  });
  const item = Object.values((await getSyncData()).contents)[0];
  expect(item).toMatchObject({
    id: "1",
    title: "a-b",
    tags: ["t", "y"],
    extraData: "notes",
    added: 1,
    name: "old.1",
  });
  await syncContent();
  expect(contentDataDB.data["1"]?.title).toBe("a-b");
  expect(await Bun.file("media/Images/a-b.1.png").exists()).toBe(true);
  expect(tagDB.data).toEqual({ t: 1, y: 1 });
});

test("edit: a generated item gets a sidecar that pins its id", async () => {
  await Bun.write("Sync/pic.png", png);
  const [before] = Object.values((await getSyncData()).contents);
  await editSyncItem({
    name: "pic",
    type: "img",
    title: "pic",
    tags: [],
    extraData: "mine",
  });
  expect(ls("Sync")).toEqual(["pic.json", "pic.png"]);
  const [after] = Object.values((await getSyncData()).contents);
  expect(after?.id).toBe(JSON.parse(await Bun.file("Sync/pic.json").text()).id);
  expect(after?.extraData).toBe("mine");
  expect(before?.extraData).toBe("Generated Data");
});

test("edit: an item from a tdata bundle takes the edit, not the bundle", async () => {
  await Bun.write("Sync/b.2.png", png);
  await Bun.write(
    "Sync/tdata.1.json",
    JSON.stringify([JSON.parse(json("2", "b", ["old"]))]),
  );
  await editSyncItem({
    name: "b.2",
    type: "img",
    title: "b",
    tags: ["new"],
    extraData: "edited",
  });
  expect(ls("Sync")).toEqual(["b.2.json", "b.2.png"]);
  await syncContent();
  expect(contentDataDB.data["2"]).toMatchObject({
    tags: ["new"],
    extraData: "edited",
  });
});

test("edit: unknown, blank and path-like names are rejected", async () => {
  await Bun.write("Sync/a.1.png", png);
  const input = { type: "img" as const, title: "t", tags: [], extraData: "" };
  await expect(editSyncItem({ ...input, name: "../x" })).rejects.toThrow();
  await expect(editSyncItem({ ...input, name: "nope" })).rejects.toThrow();
  await expect(
    editSyncItem({ ...input, name: "a.1", title: "  " }),
  ).rejects.toThrow();
  expect(ls("Sync")).toEqual(["a.1.png"]);
});

test("remove: files and sidecar move to UnSyncable, nothing is deleted", async () => {
  await Bun.write("Sync/a.1.png", png);
  await Bun.write("Sync/cover.a.1.png", png);
  await Bun.write("Sync/a.1.json", json("1", "a"));
  await Bun.write("Sync/keep.2.png", png);
  await removeSyncItem({ name: "a.1", type: "img" });
  expect(ls("UnSyncable")).toEqual(["a.1.json", "a.1.png", "cover.a.1.png"]);
  expect(ls("Sync")).toEqual(["keep.2.png"]);
  await syncContent();
  expect(Object.keys(contentDataDB.data)).toHaveLength(1);
});

test("remove: a bundled folder item leaves no entry behind, a name clash changes nothing", async () => {
  mkdirSync("Sync/g.3.gallery");
  await Bun.write(
    "Sync/tdata.1.json",
    JSON.stringify([JSON.parse(json("3", "g"))]),
  );
  await Bun.write("UnSyncable/g.3.json", "earlier");
  await expect(
    removeSyncItem({ name: "g.3", type: "gallery" }),
  ).rejects.toThrow();
  expect(ls("Sync")).toEqual(["g.3.gallery", "g.3.json"]);
  await Bun.file("UnSyncable/g.3.json").delete();
  await removeSyncItem({ name: "g.3", type: "gallery" });
  expect(ls("Sync")).toEqual([]);
  expect(ls("UnSyncable")).toEqual(["g.3.gallery", "g.3.json"]);
});

// --- direct download pipeline (downloads.ts); yt-dlp is replaced by a fake that writes files ---

const item = (id: string, title = id, scraper = "s") => ({
  id,
  title,
  scraper,
  url: "http://example.invalid/x",
  tags: ["t"],
  extraData: "",
  added: 1,
  lastUpdated: 1,
});

/** Stands in for yt-dlp: writes `<base>.png` and its cover into the `-o` folder, then exits 0. */
function fakeYtDlp(
  opts: { calls?: string[]; gate?: Promise<void>; slow?: boolean } = {},
) {
  return {
    exec(flags: string[]) {
      const ee = new EventEmitter();
      const base = (flags[flags.indexOf("-o") + 1] as string).replace(
        ".%(ext)s",
        "",
      );
      opts.calls?.push(base);
      void (async () => {
        await (opts.gate ?? Bun.sleep(5));
        await Bun.write(`${base}.png`, png);
        await Bun.write(`${dirname(base)}/cover.${basename(base)}.png`, png);
        ee.emit("progress", { percent: 50, currentSpeed: "1MiB/s", eta: "1" });
        if (opts.slow) await Bun.sleep(300); // longer than the progress throttle
        ee.emit("close", 0);
      })();
      return ee;
    },
  } as never;
}

async function idle() {
  while (getDownloadsSnapshot().running) await Bun.sleep(5);
}

test("download: a finished item goes straight into the library, never through Sync", async () => {
  await setQueue([item("7", "pic/1"), item("8", "other")]);
  const snapshots: ReturnType<typeof getDownloadsSnapshot>[] = [];
  const abort = new AbortController();
  const watching = (async () => {
    for await (const s of watchDownloads(abort.signal)) snapshots.push(s);
  })();

  expect(await startDownloads(fakeYtDlp({ slow: true }))).toBe(true);
  expect(await startDownloads(fakeYtDlp())).toBe(false); // already running
  await idle();
  abort.abort();
  await watching; // the stream ends when the client goes away

  // the title was made file-safe, so the sidecar matches the file names
  expect(contentDataDB.data["7"]).toMatchObject({
    title: "pic_1",
    tags: ["t"],
  });
  expect(await Bun.file("media/Images/pic_1.7.png").exists()).toBe(true);
  expect(ls("media/Images/.covers")).toEqual([
    "cover.other.8.png",
    "cover.pic_1.7.png",
  ]);
  expect(Object.keys(contentDataDB.data).sort()).toEqual(["7", "8"]);
  expect(tagDB.data).toEqual({ t: 2 });
  expect(await readQueue()).toEqual([]);
  expect(ls("Sync")).toEqual([]);
  expect(ls("UnSyncable")).toEqual([]);
  expect(ls("Download/done")).toEqual([]);

  expect(snapshots[0]).toEqual({ running: false, tasks: [] }); // immediate
  const last = snapshots.at(-1);
  expect(last?.running).toBe(false);
  expect(last?.tasks.map((t) => t.status)).toEqual(["completed", "completed"]);
  expect(snapshots.some((s) => s.tasks.some((t) => t.percent === 50))).toBe(
    true,
  );
});

test("download: a duplicate id fails, keeps its files in staging and is retried without downloading again", async () => {
  contentDataDB.data = { "7": { ...item("7", "old"), type: "img" } };
  await setQueue([item("7", "pic")]);
  const calls: string[] = [];
  await startDownloads(fakeYtDlp({ calls }));
  await idle();

  const [task] = getDownloadsSnapshot().tasks;
  expect(task).toMatchObject({ status: "failed" });
  expect(task?.error).toContain("already in the library");
  expect(ls("Download/done/7")).toEqual([
    "cover.pic.7.png",
    "pic.7.json",
    "pic.7.png",
  ]);
  expect(ls("media/Images")).toEqual([".covers"]);
  expect((await readQueue()).map((i) => i.id)).toEqual(["7"]);
  expect(await Bun.file("Download/error.log").text()).toContain("[pic]");

  delete contentDataDB.data["7"];
  await startDownloads(fakeYtDlp({ calls }));
  await idle();
  expect(calls).toHaveLength(1); // no second download
  expect(getDownloadsSnapshot().tasks[0]?.status).toBe("completed");
  expect(contentDataDB.data["7"]?.title).toBe("pic");
  expect(await readQueue()).toEqual([]);
  expect(ls("Download/done")).toEqual([]);
});

test("download: setQueue during a run keeps unfinished items and ignores their copies", async () => {
  await setQueue([item("1")]);
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  await startDownloads(fakeYtDlp({ gate }));

  const written = await setQueue([item("2"), item("1", "changed")]);
  expect(written.map((i) => [i.id, i.title])).toEqual([
    ["1", "1"],
    ["2", "2"],
  ]);
  open();
  await idle();
  // "1" is imported and gone; "2" waits for the next run
  expect((await readQueue()).map((i) => i.id)).toEqual(["2"]);
  expect(Object.keys(contentDataDB.data)).toEqual(["1"]);
});
