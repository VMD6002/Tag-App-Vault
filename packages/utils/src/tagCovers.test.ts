import { expect, test } from "bun:test";
import { parseTagCovers } from "./tagCovers";

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
