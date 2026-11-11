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

test("ignores unknown view tags and out-of-range widths", () => {
  expect(
    parseViewTags([
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

test("view:in-library is a display no-op (filterLibrary reads it)", () => {
  expect(parseViewTags([VIEW_IN_LIBRARY_TAG])).toEqual({});
  expect(parseViewTags([VIEW_HIDE_IN_LIBRARY_TAG])).toEqual({});
});
