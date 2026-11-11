import { afterAll, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GroupType } from "@tagapp/utils/types";

// Paths are cwd-relative and the DBs load on import, so move to a scratch root first.
const root = mkdtempSync(join(tmpdir(), "tagapp-groups-"));
process.chdir(root);
mkdirSync("DB");
const { call } = await import("@orpc/server");
const { contentDataDB } = await import("../db/contentData.js");
const { groupsDB } = await import("../db/groups.js");
const { tagDB } = await import("../db/tags.js");
const g = await import("../routers/groups.js");
const { hardResetTagCount } = await import("../routers/fix.js");
const { setDoc } = await import("./setDoc.js");
const { setDownloads, readQueue } = await import("./downloads.js");
const { syncContent } = await import("./syncContent.js");

type Item = (typeof contentDataDB.data)[string];
const item = (id: string, tags: string[] = [], groups?: string[]): Item => ({
  id,
  title: `T${id}`,
  tags,
  extraData: "",
  added: 1,
  lastUpdated: 1,
  type: "txt",
  ...(groups && { groups }),
});
const group = (id: string, tags: string[] = []): GroupType => ({
  id,
  title: id,
  extraData: "",
  tags,
  added: 1,
  lastUpdated: 1,
});

/** Tag counts rebuilt from items and groups: what `DB/tags.json` has to equal. */
const counts = () => {
  const c: Record<string, number> = {};
  for (const t of [
    ...Object.values(contentDataDB.data).flatMap((i) => i.tags),
    ...Object.values(groupsDB.data).flatMap((x) => x.tags),
  ])
    c[t] = (c[t] ?? 0) + 1;
  return c;
};
// lowdb keeps everything in memory under NODE_ENV=test (bun test), so only memory is asserted
/** The tag counts equal a recount of items and groups. */
const expectConsistent = () => expect(tagDB.data).toEqual(counts());

const seed = (items: Item[], groups: GroupType[] = []) => {
  contentDataDB.data = Object.fromEntries(items.map((i) => [i.id, i]));
  groupsDB.data = Object.fromEntries(groups.map((x) => [x.id, x]));
  tagDB.data = counts();
  for (const i of items)
    mkdirSync(`media/Texts/${i.title}.${i.id}`, { recursive: true });
};

beforeEach(async () => {
  for (const dir of ["Sync", "UnSyncable", "media", "Download"])
    rmSync(dir, { recursive: true, force: true });
  mkdirSync("Sync");
  mkdirSync("UnSyncable");
  mkdirSync("media/Texts", { recursive: true });
  seed([]);
  await Promise.all([contentDataDB.write(), groupsDB.write(), tagDB.write()]);
});
afterAll(() => {
  process.chdir(tmpdir());
  rmSync(root, { recursive: true, force: true });
});

test("create generates an id, counts the tags and rejects a taken id", async () => {
  const { group: a } = await call(g.create, {
    title: " A ",
    tags: ["x", "x", "y"],
  });
  expect(a.id).toMatch(/^grp_[\w-]{10}$/);
  expect(a).toMatchObject({ title: "A", tags: ["x", "y"], extraData: "" });
  expect(tagDB.data).toEqual({ x: 1, y: 1 });
  await call(g.create, { id: "b", title: "B", tags: ["x"] });
  expect(await call(g.list, undefined)).toHaveProperty("b");
  await expect(
    call(g.create, { id: "b", title: "again" }),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expectConsistent();
});

test("update changes the tag counts and clears the cover with an empty string", async () => {
  seed([], [{ ...group("a", ["x", "y"]), cover: "/media/c.webp" }]);
  await call(g.update, { id: "a", tags: ["y", "z"], title: "New", cover: "" });
  expect(groupsDB.data.a).toMatchObject({ title: "New", tags: ["y", "z"] });
  expect(groupsDB.data.a?.cover).toBeUndefined();
  expect(tagDB.data).toEqual({ y: 1, z: 1 });
  expect((await call(g.get, { id: "a" })).title).toBe("New");
  await expect(call(g.get, { id: "nope" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expectConsistent();
});

test("addItems and removeItems persist the ids on the items; a bad id changes nothing", async () => {
  seed([item("1"), item("2")], [group("a")]);
  await call(g.addItems, { id: "a", itemIds: ["1", "2"] });
  expect(contentDataDB.data["1"]?.groups).toEqual(["a"]);
  expect(contentDataDB.data["2"]?.groups).toEqual(["a"]);
  await call(g.removeItems, { id: "a", itemIds: ["1"] });
  expect(contentDataDB.data["1"]?.groups).toBeUndefined();
  await expect(
    call(g.addItems, { id: "a", itemIds: ["1", "nope"] }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(contentDataDB.data["1"]?.groups).toBeUndefined();
  expectConsistent();
});

test("disband drops the record and the id on every child, the items stay", async () => {
  seed(
    [item("1", ["t"], ["a", "b"]), item("2", [], ["a"])],
    [group("a", ["x"]), group("b")],
  );
  await call(g.disband, { id: "a" });
  expect(groupsDB.data.a).toBeUndefined();
  expect(contentDataDB.data["1"]?.groups).toEqual(["b"]);
  expect(contentDataDB.data["2"]?.groups).toBeUndefined();
  expect(tagDB.data).toEqual({ t: 1 });
  expectConsistent();
});

test("planDelete splits exclusive and shared children", async () => {
  seed(
    [item("1", [], ["a"]), item("2", [], ["a", "b"])],
    [group("a"), group("b")],
  );
  const plan = await call(g.planDelete, { id: "a" });
  expect(plan.exclusive.map((i) => i.id)).toEqual(["1"]);
  expect(plan.shared.map((i) => i.id)).toEqual(["2"]);
  expect(contentDataDB.data["1"]).toBeDefined(); // read-only
});

test("delete removes exclusive and chosen shared items through the delete path; other shared items lose the id", async () => {
  seed(
    [
      item("1", ["t", "u"], ["a"]),
      item("2", ["t"], ["a", "b"]),
      item("3", ["t"], ["a", "b"]),
      item("4", ["t"], ["b"]),
    ],
    [group("a", ["gx"]), group("b", ["gx"])],
  );
  const res = await call(g.delete, { id: "a", deleteIds: ["2"] });
  expect(res.deleted.sort()).toEqual(["1", "2"]);
  expect(res.detached).toEqual(["3"]);
  expect(Object.keys(contentDataDB.data).sort()).toEqual(["3", "4"]);
  expect(contentDataDB.data["3"]?.groups).toEqual(["b"]);
  expect(groupsDB.data.a).toBeUndefined();
  expect(existsSync("media/Texts/T1.1")).toBe(false);
  expect(existsSync("media/Texts/T2.2")).toBe(false);
  expect(existsSync("media/Texts/T3.3")).toBe(true);
  expectConsistent();
});

test("delete keeps the group when an item can't be deleted", async () => {
  seed([item("1", [], ["a"]), item("2", [], ["a"])], [group("a")]);
  rmSync("media/Texts/T2.2", { recursive: true }); // the files are gone: its rename fails
  await expect(
    call(g.delete, { id: "a", deleteIds: [] }),
  ).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
  expect(groupsDB.data.a).toBeDefined();
  expect(contentDataDB.data["2"]).toBeDefined();
  expect(contentDataDB.data["1"]).toBeUndefined(); // already deleted, stays deleted
  expectConsistent();
});

test("fix recreates missing records and clears an empty cover; per-group is limited to it", async () => {
  seed(
    [item("1", [], ["ghost"]), item("2", [], ["ghost2"])],
    [{ ...group("a"), cover: "" }],
  );
  const one = await call(g.fix, { id: "ghost" });
  expect(one.created).toEqual(["ghost"]);
  expect(groupsDB.data.ghost).toMatchObject({ title: "ghost", tags: [] });
  expect(groupsDB.data.ghost2).toBeUndefined();
  const all = await call(g.fix, {});
  expect(all).toEqual({ created: ["ghost2"], cleared: ["a"] });
  expect(groupsDB.data.a?.cover).toBeUndefined();
  expectConsistent();
});

test("merge re-points the children and unions the tags", async () => {
  seed(
    [item("1", [], ["a"]), item("2", [], ["b"]), item("3", [], ["a", "b"])],
    [group("a", ["x", "y"]), group("b", ["y", "z"])],
  );
  await call(g.merge, { ids: ["a", "b"], keepId: "b" });
  expect(Object.keys(groupsDB.data)).toEqual(["b"]);
  expect(groupsDB.data.b?.tags.sort()).toEqual(["x", "y", "z"]);
  expect(contentDataDB.data["1"]?.groups).toEqual(["b"]);
  expect(contentDataDB.data["3"]?.groups).toEqual(["b"]);
  await expect(
    call(g.merge, { ids: ["b"], keepId: "b" }),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expectConsistent();
});

test("changeId re-keys and rewrites the items; an existing id merges", async () => {
  seed(
    [item("1", [], ["a"]), item("2", [], ["c"])],
    [group("a", ["x"]), group("c", ["y"])],
  );
  await call(g.changeId, { oldId: "a", newId: "grp_new" });
  expect(groupsDB.data.grp_new).toMatchObject({ id: "grp_new", tags: ["x"] });
  expect(groupsDB.data.a).toBeUndefined();
  expect(contentDataDB.data["1"]?.groups).toEqual(["grp_new"]);
  await call(g.changeId, { oldId: "grp_new", newId: "c" });
  expect(Object.keys(groupsDB.data)).toEqual(["c"]);
  expect(contentDataDB.data["1"]?.groups).toEqual(["c"]);
  expectConsistent();
});

test("setDownloads registers unknown groups, never overwrites, ignores the cover", async () => {
  seed(
    [],
    [{ ...group("known", ["old"]), title: "Mine", cover: "/mine.webp" }],
  );
  tagDB.data = counts();
  const post = (id: string) => ({
    id,
    title: `T${id}`,
    tags: [],
    extraData: "",
    added: 1,
    lastUpdated: 1,
    url: `https://x/${id}`,
    scraper: "s",
    groups: ["known", "fresh"],
  });
  await setDownloads({
    items: [post("d1")],
    groups: [
      { ...group("known", ["new"]), title: "Theirs", cover: "https://x/c.jpg" },
      { ...group("fresh", ["f", "f"]), cover: "https://x/c.jpg" },
    ],
  });
  expect(groupsDB.data.known).toMatchObject({
    title: "Mine",
    tags: ["old"],
    cover: "/mine.webp",
  });
  expect(groupsDB.data.fresh).toMatchObject({ tags: ["f"] });
  expect(groupsDB.data.fresh?.cover).toBeUndefined();
  expect(tagDB.data).toEqual({ old: 1, f: 1 });
  expect((await readQueue())[0]?.groups).toEqual(["known", "fresh"]);
});

test("sync creates the group records it doesn't know, existing ones stay", async () => {
  seed([], [{ ...group("known"), title: "Mine" }]);
  mkdirSync("Sync/Tx.s1.txt");
  await Bun.write(
    "Sync/Tx.s1.json",
    JSON.stringify({
      id: "s1",
      title: "Tx",
      tags: ["t"],
      extraData: "",
      added: 1,
      lastUpdated: 1,
      groups: ["known", "new1"],
    }),
  );
  await syncContent();
  expect(contentDataDB.data.s1?.groups).toEqual(["known", "new1"]);
  expect(groupsDB.data.known?.title).toBe("Mine");
  expect(groupsDB.data.new1).toMatchObject({
    id: "new1",
    title: "new1",
    tags: [],
    extraData: "",
  });
  expect(groupsDB.data.new1?.cover).toBeUndefined();
  expectConsistent();
});

test("sync sets the cover of a childless group once: stub or existing, never non-empty or with children", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
    "base64",
  );
  seed(
    [item("old", [], ["busy"])],
    [
      { ...group("empty"), cover: "" },
      { ...group("own"), cover: "/own.webp" },
      group("busy"),
    ],
  );
  mkdirSync("media/Images/.covers", { recursive: true });
  const send = async (id: string, groups: string[]) => {
    await Bun.write(`Sync/${id}.${id}.png`, png);
    await Bun.write(`Sync/cover.${id}.${id}.png`, png);
    await Bun.write(
      `Sync/${id}.${id}.json`,
      JSON.stringify({
        id,
        title: id,
        tags: [],
        extraData: "",
        added: 1,
        lastUpdated: 1,
        groups,
      }),
    );
  };
  await send("p1", ["empty", "own", "busy", "stub"]);
  await syncContent();
  const url = "/media/Images/.covers/cover.p1.p1"; // the library card URL: no extension
  expect(groupsDB.data.empty?.cover).toBe(url);
  expect(groupsDB.data.stub?.cover).toBe(url);
  expect(groupsDB.data.own?.cover).toBe("/own.webp");
  expect(groupsDB.data.busy?.cover).toBeUndefined();
  // a second item does not replace it
  await send("p2", ["stub"]);
  await syncContent();
  expect(groupsDB.data.stub?.cover).toBe(url);
});

test("hardResetTagCount counts group tags", async () => {
  seed([item("1", ["a", "b"])], [group("g", ["a", "gt"])]);
  tagDB.data = {};
  expect(await call(hardResetTagCount, undefined)).toEqual({
    a: 2,
    b: 1,
    gt: 1,
  });
});

test("renaming an item keeps its groups", async () => {
  seed([item("1", [], ["a"])], [group("a")]);
  await setDoc({ id: "1", title: "Renamed", tags: ["n"], extraData: "x" });
  expect(contentDataDB.data["1"]).toMatchObject({
    title: "Renamed",
    groups: ["a"],
  });
  expectConsistent();
});

test("setContent groups: join and leave with the item, counts stay right, a cover is set once, empty clears", async () => {
  const doc = (id: string, groups?: string[], tags: string[] = []) => ({
    id,
    title: `T${id}`,
    tags,
    extraData: "",
    groups,
  });
  seed(
    [
      { ...item("1", ["t"], ["a"]), cover: "c1.webp" },
      { ...item("2", [], []), cover: "c2.webp" },
      { ...item("3", [], []), cover: "c3.webp" },
    ],
    [
      group("a"), // already has child 1, no cover: stays without
      { ...group("empty"), cover: "" },
      { ...group("own", ["gt"]), cover: "/own.webp" },
    ],
  );
  // absent `groups` leaves them alone
  await setDoc(doc("1", undefined, ["t", "n"]));
  expect(contentDataDB.data["1"]?.groups).toEqual(["a"]);

  await setDoc(doc("2", ["empty", "own", "a"], ["n"]));
  expect(contentDataDB.data["2"]?.groups).toEqual(["empty", "own", "a"]);
  expect(groupsDB.data.empty?.cover).toBe("/media/Texts/T2.2/.media/c2.webp");
  expect(groupsDB.data.own?.cover).toBe("/own.webp");
  expect(groupsDB.data.a?.cover).toBeUndefined();

  // a later joiner does not replace the cover; leaving keeps it (set once)
  await setDoc(doc("3", ["empty"]));
  expect(groupsDB.data.empty?.cover).toBe("/media/Texts/T2.2/.media/c2.webp");
  await setDoc(doc("2", ["own"], ["n"]));
  expect(contentDataDB.data["2"]?.groups).toEqual(["own"]);
  expect(groupsDB.data.empty?.cover).toBe("/media/Texts/T2.2/.media/c2.webp");

  // `[]` clears and drops the key; join + title change together
  await setDoc({ ...doc("1", []), title: "Renamed", tags: ["t", "n"] });
  expect(contentDataDB.data["1"]?.groups).toBeUndefined();
  expect(existsSync("media/Texts/Renamed.1")).toBe(true);
  expectConsistent();
});

test("setContent groups: an unknown group id changes nothing, not even the title", async () => {
  seed([item("1", ["t"], ["a"])], [group("a")]);
  await expect(
    setDoc({
      id: "1",
      title: "Renamed",
      tags: [],
      extraData: "",
      groups: ["a", "nope"],
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(contentDataDB.data["1"]).toMatchObject({ title: "T1", groups: ["a"] });
  expect(existsSync("media/Texts/T1.1")).toBe(true);
  expectConsistent();
});

test("setContent groups: renaming and joining an empty group in one save sets the cover from the new title", async () => {
  seed(
    [{ ...item("1", [], []), cover: "c1.webp" }],
    [{ ...group("empty"), cover: "" }],
  );
  await setDoc({
    id: "1",
    title: "New",
    tags: [],
    extraData: "",
    groups: ["empty"],
  });
  expect(groupsDB.data.empty?.cover).toBe("/media/Texts/New.1/.media/c1.webp");
  expectConsistent();
});
