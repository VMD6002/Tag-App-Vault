import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadContent } from "./downloadContent";

const dir = mkdtempSync(join(tmpdir(), "dl-"));
const hits: Record<string, number> = {};
const server = Bun.serve({
  port: 0,
  fetch(req) {
    const path = new URL(req.url).pathname;
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === "/flaky" && hits[path] < 3)
      return new Response("busy", { status: 503 });
    if (path === "/missing") return new Response("no", { status: 404 });
    if (path === "/down") return new Response("down", { status: 500 });
    return new Response("ok");
  },
});
const url = (p: string) => `http://localhost:${server.port}${p}`;
afterAll(() => {
  server.stop();
  rmSync(dir, { recursive: true, force: true });
});

test("retries 5xx until success", async () => {
  await downloadContent(url("/flaky"), join(dir, "a"), "ua", 1);
  expect(hits["/flaky"]).toBe(3);
  expect(readFileSync(join(dir, "a"), "utf-8")).toBe("ok");
});

test("gives up after 3 attempts", async () => {
  await expect(
    downloadContent(url("/down"), join(dir, "b"), "ua", 1),
  ).rejects.toThrow("HTTP 500");
  expect(hits["/down"]).toBe(3);
  expect(existsSync(join(dir, "b"))).toBe(false);
});

test("does not retry 404", async () => {
  await expect(
    downloadContent(url("/missing"), join(dir, "c"), "ua", 1),
  ).rejects.toThrow("HTTP 404");
  expect(hits["/missing"]).toBe(1);
});
