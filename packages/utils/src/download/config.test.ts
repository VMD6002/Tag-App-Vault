import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, loadConfig } from "./config";

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
