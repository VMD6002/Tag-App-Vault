import { expect, test } from "bun:test";
import { parseViewTags } from "./viewTags";

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

test("meta:autoplay is an alias of view:autoplay", () => {
  expect(parseViewTags(["meta:autoplay"])).toEqual({ autoPlay: true });
  expect(parseViewTags(["view:no-autoplay", "meta:autoplay"])).toEqual({
    autoPlay: false,
  });
});
