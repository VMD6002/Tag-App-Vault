import { expect, test } from "bun:test";
import { parseInjectedGroups, parseTagCovers } from "./tagCovers";

test("parseTagCovers keeps http(s) string entries only", () => {
  expect(
    parseTagCovers({
      a: "https://x.test/a.png",
      b: "http://x.test/b.png",
      c: "javascript:alert(1)",
      d: "data:image/png;base64,AAAA",
      e: "/relative.png",
      f: 5,
      g: null,
      h: "",
    }),
  ).toEqual({ a: "https://x.test/a.png", b: "http://x.test/b.png" });
});

test("parseTagCovers ignores non-records", () => {
  for (const v of [undefined, null, "x", 3, ["https://x.test/a.png"]])
    expect(parseTagCovers(v)).toEqual({});
});

const grp = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  title: `Title ${id}`,
  extraData: "",
  tags: ["a"],
  added: 1,
  lastUpdated: 2,
  ...o,
});

test("parseInjectedGroups keeps valid records and drops the rest", () => {
  const out = parseInjectedGroups([
    grp("g1", { cover: "https://x.test/c.png", extra: "stripped" }),
    grp("g2"),
    grp("g1", { title: "second wins nothing" }),
    grp("", {}),
    grp("g3", { tags: "nope" }),
    { id: "g4" },
    null,
    "x",
  ]);
  expect(Object.keys(out)).toEqual(["g1", "g2"]);
  expect(out.g1).toEqual(grp("g1", { cover: "https://x.test/c.png" }));
  expect(out.g2).toEqual(grp("g2"));
});

test("parseInjectedGroups drops covers that are not http(s) but keeps the group", () => {
  const out = parseInjectedGroups([
    grp("a", { cover: "javascript:alert(1)" }),
    grp("b", { cover: "/relative.png" }),
    grp("c", { cover: "" }),
    grp("d", { cover: "http://x.test/d.png" }),
  ]);
  expect(Object.keys(out)).toEqual(["a", "b", "c", "d"]);
  expect(out.a).toEqual(grp("a"));
  expect(out.b).toEqual(grp("b"));
  expect(out.c).toEqual(grp("c"));
  expect(out.d?.cover).toBe("http://x.test/d.png");
});

test("parseInjectedGroups ignores non-arrays and a __proto__ id stays a plain key", () => {
  for (const v of [undefined, null, "x", 3, { g: grp("g") }])
    expect(parseInjectedGroups(v)).toEqual({});
  const out = parseInjectedGroups([grp("__proto__")]);
  expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  expect(Object.keys(out)).toEqual(["__proto__"]);
});
