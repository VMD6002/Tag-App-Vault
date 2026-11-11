import { describe, expect, test } from "bun:test";
import { filterLibrary } from "./filterData";
import {
  addGroupItems,
  applyTagDelta,
  changeGroupId,
  createGroup,
  deleteGroup,
  disbandGroup,
  fixGroups,
  type GroupState,
  groupChildren,
  groupIdsOf,
  groupSortKey,
  groupTagStats,
  mergeGroups,
  newGroupId,
  pickGroupCover,
  planDeleteGroup,
  referencedGroups,
  removeGroupItems,
  sharedChildren,
  updateGroup,
} from "./groups";
import type { ContentServerType, GroupType } from "./types";
import { VIEW_HIDE_IN_LIBRARY_TAG, VIEW_IN_LIBRARY_TAG } from "./viewTags";

const item = (
  id: string,
  added: number,
  o: Partial<ContentServerType> = {},
): ContentServerType => ({
  id,
  title: id,
  tags: [],
  extraData: "",
  type: "img",
  added,
  lastUpdated: added,
  ...o,
});
const grp = (id: string, o: Partial<GroupType> = {}): GroupType => ({
  id,
  title: id,
  extraData: "",
  tags: [],
  added: 10,
  lastUpdated: 10,
  ...o,
});
const q = {
  any: [],
  all: [],
  none: [],
  search: "",
  types: [],
  orderByLatest: true,
};
const labels = (r: ReturnType<typeof filterLibrary>) =>
  r.map((e) => (e.kind === "item" ? e.item.id : `[${e.group.id}]`));

// solo (no group), a/b in g1, c in g1+g2, d in g2 with the opt-in tag, g3 is empty
const content = () => ({
  solo: item("solo", 1),
  a: item("a", 5, { groups: ["g1"], tags: ["Type:X"] }),
  b: item("b", 6, { groups: ["g1"], extraData: "needle" }),
  c: item("c", 7, { groups: ["g1", "g2"], tags: ["Site:Y"] }),
  d: item("d", 2, { groups: ["g2"], tags: [VIEW_IN_LIBRARY_TAG] }),
});
const groups = () => ({
  g1: grp("g1", { title: "Alpha", added: 3, lastUpdated: 30 }),
  g2: grp("g2", {
    title: "Beta",
    added: 20,
    lastUpdated: 4,
    extraData: "needle",
  }),
  g3: grp("g3", { title: "Empty" }),
});

describe("filterLibrary", () => {
  test("hides grouped items unless view:in-library, shows non-empty cards", () => {
    // newest child: g1 -> 7, g2 -> 7 (tie keeps insertion order g1, g2); d (2) and solo (1) follow
    expect(labels(filterLibrary(q, content(), groups()))).toEqual([
      "[g1]",
      "[g2]",
      "d",
      "solo",
    ]);
  });
  describe("view:hide-in-library", () => {
    const H = VIEW_HIDE_IN_LIBRARY_TAG;
    const hidden = () => ({
      ...content(),
      h: item("h", 9, { tags: [H, "Type:X"] }),
      // grouped + opted in + hidden: hidden wins
      k: item("k", 8, { groups: ["g2"], tags: [VIEW_IN_LIBRARY_TAG, H] }),
    });
    const ids = (query: object) =>
      labels(filterLibrary({ ...q, ...query }, hidden(), groups()));
    test("drops the item in both modes", () => {
      expect(ids({})).not.toContain("h");
      expect(ids({})).not.toContain("k");
      expect(ids({ itemsOnly: true })).not.toContain("h");
      expect(ids({ showGrouped: true })).not.toContain("h");
    });
    test("any or all containing the tag shows it; other tags or wildcards do not", () => {
      expect(ids({ any: [H] })).toContain("h");
      expect(ids({ all: [H] })).toEqual(expect.arrayContaining(["h", "k"]));
      expect(ids({ all: [H, "Type:X"] })).toEqual(["h"]);
      expect(ids({ any: ["Type:X"] })).not.toContain("h");
      expect(ids({ any: ["view:*"] })).not.toContain("h");
      expect(ids({ none: [H] })).not.toContain("h");
    });
    test("ignoreHidden (group pages) keeps it", () => {
      expect(ids({ itemsOnly: true, ignoreHidden: true })).toContain("h");
    });
  });
  test("no groups record means nothing is hidden", () => {
    expect(labels(filterLibrary(q, content()))).toHaveLength(5);
  });
  test("showGrouped lists every grouped item next to the cards", () => {
    expect(
      labels(filterLibrary({ ...q, showGrouped: true }, content(), groups())),
    ).toEqual(["c", "[g1]", "[g2]", "b", "a", "d", "solo"]); // ties: items before cards
  });
  test("mode 1 searches group and item titles only", () => {
    expect(
      labels(filterLibrary({ ...q, search: "Alpha" }, content(), groups())),
    ).toEqual(["[g1]"]);
    // a hidden child's title match does not surface it
    expect(
      labels(filterLibrary({ ...q, search: "b" }, content(), groups())),
    ).not.toContain("b");
  });
  test("mode 2 (itemsOnly) lists items incl. grouped, never cards", () => {
    expect(
      labels(filterLibrary({ ...q, itemsOnly: true }, content(), groups())),
    ).toEqual(["c", "b", "a", "d", "solo"]);
    expect(
      labels(
        filterLibrary(
          { ...q, itemsOnly: true, search: "a" },
          content(),
          groups(),
        ),
      ),
    ).toContain("a");
  });
  test("searchDescription adds extraData, within each mode's rules", () => {
    const base = { ...q, search: "needle" };
    expect(labels(filterLibrary(base, content(), groups()))).toEqual([]);
    expect(
      labels(
        filterLibrary(
          { ...base, searchDescription: true },
          content(),
          groups(),
        ),
      ),
    ).toEqual(["[g2]"]); // b is hidden in mode 1
    expect(
      labels(
        filterLibrary(
          { ...base, searchDescription: true, itemsOnly: true },
          content(),
          groups(),
        ),
      ),
    ).toEqual(["b"]);
  });
  test("a card matches any/all on its own tags or one child's tags", () => {
    const g = groups();
    g.g2.tags = ["Own:1"];
    expect(
      labels(filterLibrary({ ...q, any: ["Own:1"] }, content(), g)),
    ).toEqual(["[g2]"]);
    expect(
      labels(filterLibrary({ ...q, any: ["Type:X"] }, content(), g)),
    ).toEqual(["[g1]"]);
    expect(
      labels(filterLibrary({ ...q, any: ["Type:*"] }, content(), g)),
    ).toEqual(["[g1]"]); // wildcards work on cards too
    expect(
      labels(filterLibrary({ ...q, all: ["Type:X", "Site:Y"] }, content(), g)),
    ).toEqual([]); // no single carrier
  });
  test("none excludes a card by its own tags only", () => {
    const g = groups();
    g.g1.tags = ["Bad"];
    expect(
      labels(filterLibrary({ ...q, none: ["Bad"] }, content(), g)),
    ).toEqual(["[g2]", "d", "solo"]);
  });
  test("types filter items; a card needs a child of a wanted type", () => {
    const c = content();
    c.a.type = "video";
    c.b.type = "video";
    c.c.type = "video"; // g1 and g2 hold videos only through a, b, c
    c.d.type = "video";
    expect(
      labels(filterLibrary({ ...q, types: ["img"] }, c, groups())),
    ).toEqual(["solo"]);
    expect(
      labels(filterLibrary({ ...q, types: ["video"] }, c, groups())),
    ).toEqual(["[g1]", "[g2]", "d"]);
  });
  test("groups without children are excluded", () => {
    expect(labels(filterLibrary(q, {}, groups()))).toEqual([]);
  });
  test("group sort: newest child (default), created, lastUpdated", () => {
    const only = (groupSort: "created" | "updated") =>
      labels(filterLibrary({ ...q, groupSort }, content(), groups())).filter(
        (l) => l.startsWith("["),
      );
    expect(only("created")).toEqual(["[g2]", "[g1]"]);
    expect(only("updated")).toEqual(["[g1]", "[g2]"]);
    expect(
      labels(
        filterLibrary(
          { ...q, orderByLatest: false, groupSort: "created" },
          content(),
          groups(),
        ),
      ).filter((l) => l.startsWith("[")),
    ).toEqual(["[g1]", "[g2]"]);
  });
});

describe("group helpers", () => {
  test("children, stats, shared, ids, referenced", () => {
    const c = content();
    const kids = groupChildren(c, "g1");
    expect(kids.map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(groupTagStats(kids)).toEqual({ "Type:X": 1, "Site:Y": 1 });
    expect(sharedChildren(kids).map((k) => k.id)).toEqual(["c"]);
    expect(groupIdsOf(Object.values(c)).sort()).toEqual(["g1", "g2"]);
    expect(referencedGroups([c.a], groups()).map((g) => g.id)).toEqual(["g1"]);
  });
  test("pickGroupCover: own cover wins, then newest / oldest / first with cover", () => {
    const kids = [
      item("x", 1, { cover: "old" }),
      item("y", 2),
      item("z", 3, { cover: "new" }),
    ];
    expect(pickGroupCover({ cover: "own" }, kids, "newest")).toBe("own");
    expect(pickGroupCover({}, kids)).toBe("new");
    expect(pickGroupCover({}, kids, "oldest")).toBe("old");
    expect(pickGroupCover({}, [...kids].reverse(), "firstWithCover")).toBe(
      "new",
    );
    expect(pickGroupCover({}, [item("n", 1)], "newest")).toBeUndefined();
  });
  test("groupSortKey per mode", () => {
    const g = grp("g", { added: 3, lastUpdated: 4 });
    const kids = [item("x", 8), item("y", 9)];
    expect(groupSortKey(g, kids)).toBe(9);
    expect(groupSortKey(g, kids, "created")).toBe(3);
    expect(groupSortKey(g, kids, "updated")).toBe(4);
    expect(groupSortKey(g, [])).toBe(3);
  });
  test("newGroupId looks like grp_<10 url-safe chars> and differs per call", () => {
    expect(newGroupId()).toMatch(/^grp_[\w-]{10}$/);
    expect(newGroupId()).not.toBe(newGroupId());
  });
  test("applyTagDelta mirrors Increment/DecrementTagCount", () => {
    const tags: Record<string, number> = { a: 1, b: 2 };
    applyTagDelta(tags, { a: -1, b: -1, c: 1, ghost: -1 });
    expect(tags).toEqual({ b: 1, c: 1 });
  });
});

const grpOf = (s: { groups: Record<string, GroupType> }, id: string) => {
  const g = s.groups[id];
  if (!g) throw new Error(`no ${id}`);
  return g;
};

// Server-style tag counts: item tags plus group tags.
const countTags = (s: GroupState) => {
  const out: Record<string, number> = {};
  for (const tags of [
    ...Object.values(s.contentData).map((i) => i.tags),
    ...Object.values(s.groups).map((g) => g.tags),
  ])
    for (const t of new Set(tags)) out[t] = (out[t] ?? 0) + 1;
  return out;
};
const state = () => {
  const s = {
    contentData: content() as Record<string, ContentServerType>,
    groups: groups() as Record<string, GroupType>,
  };
  grpOf(s, "g1").tags = ["Type:X", "G:one"];
  return { s, tags: countTags(s) };
};
/** Runs an op on a fresh state and checks the returned delta keeps the counts in sync. */
const run = <R extends { tagDelta: Record<string, number> }>(
  op: (s: ReturnType<typeof state>["s"]) => R,
  prep?: (s: ReturnType<typeof state>["s"]) => void,
) => {
  const { s, tags } = state();
  prep?.(s);
  const before = countTags(s);
  Object.assign(tags, before);
  const r = op(s);
  applyTagDelta(tags, r.tagDelta);
  expect(tags).toEqual(countTags(s));
  return { s, r };
};

describe("group ops", () => {
  test("create / update return tag deltas, trim, clear cover with empty string", () => {
    const { s } = run(
      (s) =>
        createGroup(
          s,
          {
            id: "g9",
            title: " Nine ",
            extraData: "",
            tags: ["T:1", "T:1"],
            cover: "",
          },
          50,
        ),
      undefined,
    );
    expect(s.groups.g9).toMatchObject({
      title: "Nine",
      tags: ["T:1"],
      cover: undefined,
      added: 50,
    });
    const r = updateGroup(s, { id: "g9", tags: ["T:2"], cover: "u" }, 60);
    expect(r.tagDelta).toEqual({ "T:1": -1, "T:2": 1 });
    expect(s.groups.g9).toMatchObject({
      tags: ["T:2"],
      cover: "u",
      lastUpdated: 60,
    });
    updateGroup(s, { id: "g9", cover: "" }, 61);
    expect(s.groups.g9?.cover).toBeUndefined();
    expect(() =>
      createGroup(s, { id: "g9", title: "", extraData: "", tags: [] }, 1),
    ).toThrow();
    expect(() =>
      createGroup(s, { id: " ", title: "", extraData: "", tags: [] }, 1),
    ).toThrow();
  });
  test("update with unchanged tags yields no delta", () => {
    const { s } = state();
    const r = updateGroup(s, { id: "g1", tags: ["G:one", "Type:X"] }, 5);
    expect(r.tagDelta).toEqual({});
  });
  test("addItems / removeItems edit item ids; unknown ids throw before any change", () => {
    const { s } = state();
    const add = addGroupItems(s, { id: "g2", itemIds: ["solo", "a"] }, 99);
    expect(add.changed.map((i) => i.id)).toEqual(["solo", "a"]);
    expect(s.contentData.solo?.groups).toEqual(["g2"]);
    expect(s.contentData.solo?.lastUpdated).toBe(99);
    expect(
      addGroupItems(s, { id: "g2", itemIds: ["solo"] }, 100).changed,
    ).toEqual([]);
    expect(() =>
      addGroupItems(s, { id: "g2", itemIds: ["b", "nope"] }, 100),
    ).toThrow();
    expect(s.contentData.b?.groups).toEqual(["g1"]);
    removeGroupItems(s, { id: "g2", itemIds: ["solo"] }, 101);
    expect(s.contentData.solo?.groups).toBeUndefined();
    expect(() => addGroupItems(s, { id: "nope", itemIds: [] }, 1)).toThrow();
  });
  test("disband keeps items, strips the id, drops tag counts", () => {
    const { s, r } = run((s) => disbandGroup(s, { id: "g1" }, 70));
    expect(s.groups.g1).toBeUndefined();
    expect(Object.keys(s.contentData)).toHaveLength(5);
    expect(s.contentData.c?.groups).toEqual(["g2"]);
    expect(s.contentData.a?.groups).toBeUndefined();
    expect(r.changed.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  test("planDeleteGroup is read-only and splits exclusive vs shared", () => {
    const { s } = state();
    const plan = planDeleteGroup(s, { id: "g1", deleteIds: [] });
    expect(plan.remove.map((i) => i.id)).toEqual(["a", "b"]);
    expect(plan.detach.map((i) => i.id)).toEqual(["c"]);
    expect(
      planDeleteGroup(s, { id: "g1", deleteIds: ["c"] }).remove,
    ).toHaveLength(3);
    expect(s.groups.g1).toBeDefined();
    expect(s.contentData.a).toBeDefined();
  });
  test("delete removes exclusive items and chosen shared ones; other shared lose the id", () => {
    const { s } = state();
    const res = deleteGroup(s, { id: "g1", deleteIds: [] }, 80);
    expect(res.remove.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.contentData.a).toBeUndefined();
    expect(s.contentData.c?.groups).toEqual(["g2"]);
    expect(s.contentData.c?.lastUpdated).toBe(80);
    expect(s.groups.g1).toBeUndefined();
    expect(res.tagDelta).toEqual({ "Type:X": -1, "G:one": -1 });

    const s2 = state().s;
    deleteGroup(s2, { id: "g1", deleteIds: ["c"] }, 80);
    expect(s2.contentData.c).toBeUndefined();
  });
  test("fixData recreates missing records and clears an empty-string cover only", () => {
    const { s } = state();
    s.contentData.solo = item("solo", 1, { groups: ["lost"] });
    grpOf(s, "g1").cover = "";
    grpOf(s, "g2").cover = "https://x/y.jpg";
    const r = fixGroups(s, {}, 90);
    expect(r).toEqual({ created: ["lost"], cleared: ["g1"] });
    expect(s.groups.lost).toMatchObject({
      title: "lost",
      extraData: "",
      tags: [],
    });
    expect(s.groups.lost?.cover).toBeUndefined();
    expect(grpOf(s, "g2").cover).toBe("https://x/y.jpg");
    // per group: only that group's work; no children means nothing is created
    const s3 = state().s;
    s3.contentData.solo = item("solo", 1, { groups: ["lost", "lost2"] });
    expect(fixGroups(s3, { id: "lost2" }, 1).created).toEqual(["lost2"]);
    expect(s3.groups.lost).toBeUndefined();
    expect(fixGroups(s3, { id: "ghost" }, 1)).toEqual({
      created: [],
      cleared: [],
    });
  });
  test("merge unions tags, keeps the kept group's fields, re-points children", () => {
    const { s, r } = run(
      (s) => mergeGroups(s, { ids: ["g1", "g2"], keepId: "g2" }, 95),
      (s) => {
        grpOf(s, "g2").tags = ["Type:X", "B:2"];
      },
    );
    expect(s.groups.g1).toBeUndefined();
    expect(s.groups.g2).toMatchObject({ title: "Beta", extraData: "needle" });
    expect(s.groups.g2?.tags.sort()).toEqual(["B:2", "G:one", "Type:X"]);
    expect(s.contentData.c?.groups).toEqual(["g2"]); // was in both: deduped
    expect(s.contentData.a?.groups).toEqual(["g2"]);
    expect(r.changed.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
    expect(() => mergeGroups(s, { ids: ["g2"], keepId: "g2" }, 1)).toThrow();
    expect(() =>
      mergeGroups(s, { ids: ["g2", "nope"], keepId: "g2" }, 1),
    ).toThrow();
  });
  test("changeId re-keys and rewrites items; an existing newId merges into it", () => {
    const { s } = state();
    changeGroupId(s, { oldId: "g1", newId: "vault1" }, 96);
    expect(s.groups.vault1).toMatchObject({ id: "vault1", title: "Alpha" });
    expect(s.groups.g1).toBeUndefined();
    expect(s.contentData.c?.groups).toEqual(["vault1", "g2"]);
    const r = changeGroupId(s, { oldId: "vault1", newId: "g2" }, 97);
    expect(s.groups.vault1).toBeUndefined();
    expect(s.groups.g2?.title).toBe("Beta");
    expect(s.contentData.c?.groups).toEqual(["g2"]);
    expect(r.tagDelta).toEqual({}); // g1 and g2 tags union to g1's tags: net zero
    expect(() => changeGroupId(s, { oldId: "g2", newId: " " }, 1)).toThrow();
  });
});
