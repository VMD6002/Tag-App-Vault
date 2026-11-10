import { expect, test } from "bun:test";
import { parseArgs } from "./args";

test("parseArgs: no args", () => {
  expect(parseArgs([])).toEqual({ help: false, retries: 0 });
});

test("parseArgs: retry forms", () => {
  expect(parseArgs(["--retry"]).retries).toBe(Infinity);
  expect(parseArgs(["-r"]).retries).toBe(Infinity);
  expect(parseArgs(["--retry", "10"]).retries).toBe(10);
  expect(parseArgs(["-r", "3"]).retries).toBe(3);
});

test("parseArgs: help", () => {
  expect(parseArgs(["-h"]).help).toBe(true);
  expect(parseArgs(["--help"]).help).toBe(true);
});

test("parseArgs: errors", () => {
  for (const bad of ["0", "abc", "1.5", "-1"])
    expect(() => parseArgs(["-r", bad])).toThrow();
  expect(() => parseArgs(["--nope"])).toThrow("Unknown argument");
});
