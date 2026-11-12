import { expect, test } from "bun:test";
import { RESERVED_TAGS, withReservedTags } from "./reservedTags";
import {
  parseViewTags,
  VIEW_HIDE_IN_LIBRARY_TAG,
  VIEW_IN_LIBRARY_TAG,
} from "./viewTags";

test("reserved list has no duplicates, every view: tag parses, extension order is kept", () => {
  expect(new Set(RESERVED_TAGS).size).toBe(RESERVED_TAGS.length);
  for (const tag of RESERVED_TAGS.filter(
    (t) =>
      t.startsWith("view:") &&
      t !== VIEW_IN_LIBRARY_TAG &&
      t !== VIEW_HIDE_IN_LIBRARY_TAG,
  ))
    expect(Object.keys(parseViewTags([tag])).length).toBeGreaterThan(0);
  const out = withReservedTags(["b", "view:list", "a"]);
  expect(out.slice(0, 3)).toEqual(["b", "view:list", "a"]);
  expect(new Set(out).size).toBe(out.length);
});
