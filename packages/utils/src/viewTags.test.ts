import { expect, test } from "bun:test";
import {
  parseViewTags,
  VIEW_HIDE_IN_LIBRARY_TAG,
  VIEW_IN_LIBRARY_TAG,
} from "./viewTags";

test("maps each kind of view tag", () => {
  expect(
    parseViewTags([
      "Type:Gallery",
      "view:sort-oldest",
      "view:grid-3",
      "view:no-autoplay",
      "view:width-60",
    ]),
  ).toEqual({
    sortMode: "created-date-asc",
    viewMode: "grid-3",
    autoPlay: false,
    listWidth: 60,
  });
});

test("ignores unknown view tags, out-of-range widths and the library display tags", () => {
  expect(
    parseViewTags([
      VIEW_IN_LIBRARY_TAG,
      VIEW_HIDE_IN_LIBRARY_TAG,
      "view:nope",
      "view:width-5",
      "view:width-101",
      "view:width-x",
      "View:list",
    ]),
  ).toEqual({});
});

test("first conflicting tag wins", () => {
  expect(
    parseViewTags([
      "view:list",
      "view:grid-2",
      "view:sort-z-a",
      "view:sort-a-z",
    ]),
  ).toEqual({
    viewMode: "list",
    sortMode: "name-desc",
  });
});
