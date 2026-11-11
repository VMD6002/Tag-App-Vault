import { expect, test } from "bun:test";
import { RESERVED_TAGS, withReservedTags } from "./reservedTags";
import {
  parseViewTags,
  VIEW_HIDE_IN_LIBRARY_TAG,
  VIEW_IN_LIBRARY_TAG,
} from "./viewTags";

test("reserved list has no duplicates and every view: tag parses", () => {
  expect(new Set(RESERVED_TAGS).size).toBe(RESERVED_TAGS.length);
  for (const tag of RESERVED_TAGS.filter(
    (t) =>
      t.startsWith("view:") &&
      t !== VIEW_IN_LIBRARY_TAG &&
      t !== VIEW_HIDE_IN_LIBRARY_TAG,
  ))
    expect(Object.keys(parseViewTags([tag])).length).toBeGreaterThan(0);
  expect(RESERVED_TAGS).toContain("view:width-100");
  expect(RESERVED_TAGS).toContain(VIEW_IN_LIBRARY_TAG);
  expect(RESERVED_TAGS).toContain(VIEW_HIDE_IN_LIBRARY_TAG);
  expect(RESERVED_TAGS).not.toContain("meta:autoplay");
});

test("withReservedTags keeps extension order and adds no duplicates", () => {
  const out = withReservedTags(["b", "view:list", "a"]);
  expect(out.slice(0, 3)).toEqual(["b", "view:list", "a"]);
  expect(new Set(out).size).toBe(out.length);
  expect(out).toContain("meta:caption");
});
