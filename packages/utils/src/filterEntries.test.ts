import { expect, test } from "bun:test";
import { filterEntries } from "./filterEntries";

const base: {
  any: string[];
  all: string[];
  none: string[];
  search: string;
  types: string[];
} = { any: [], all: [], none: [], search: "", types: [] };
const entries = [
  { name: "a.jpg", type: "img", tags: ["Place:Sea", "fav"] },
  { name: "b.mp4", type: "video", tags: ["Place:Sea"] },
  { name: "c.jpg", type: "img" },
];
const names = (q: Partial<typeof base>) =>
  filterEntries({ ...base, ...q }, entries).map((e) => e.name);

test("no filters keeps every entry in order", () => {
  expect(names({})).toEqual(["a.jpg", "b.mp4", "c.jpg"]);
});

test("type, any (with wildcard), none and all", () => {
  expect(names({ types: ["video"] })).toEqual(["b.mp4"]);
  expect(names({ any: ["Place:*"] })).toEqual(["a.jpg", "b.mp4"]);
  expect(names({ any: ["*"], none: ["fav"] })).toEqual(["b.mp4"]);
  expect(names({ all: ["Place:Sea", "fav"] })).toEqual(["a.jpg"]);
});

test("search matches the file name; untagged entries have no tags", () => {
  expect(names({ search: "b.mp4" })).toEqual(["b.mp4"]);
  expect(names({ none: ["fav"], types: ["img"] })).toEqual(["c.jpg"]);
});
