import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./args";
import { DEFAULT_CONFIG, loadConfig } from "./config";

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

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cli-config-"));
  file = join(dir, "config.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("loadConfig: missing file writes defaults", () => {
  expect(loadConfig(file)).toEqual(DEFAULT_CONFIG);
  expect(JSON.parse(readFileSync(file, "utf-8"))).toEqual(DEFAULT_CONFIG);
});

test("loadConfig: partial file is merged", () => {
  writeFileSync(file, JSON.stringify({ retryDelayMinutes: 1 }));
  expect(loadConfig(file)).toEqual({ ...DEFAULT_CONFIG, retryDelayMinutes: 1 });
  expect(JSON.parse(readFileSync(file, "utf-8"))).toEqual({
    ...DEFAULT_CONFIG,
    retryDelayMinutes: 1,
  });
});

test("loadConfig: invalid JSON throws and leaves the file alone", () => {
  writeFileSync(file, "{nope");
  expect(() => loadConfig(file)).toThrow("Invalid JSON");
  expect(readFileSync(file, "utf-8")).toBe("{nope");
});
