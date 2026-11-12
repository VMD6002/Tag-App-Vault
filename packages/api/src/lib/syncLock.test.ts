import { expect, test } from "bun:test";
import { createLock } from "./syncLock";

test("createLock runs tasks one at a time in call order, and a rejection does not block the next", async () => {
  const lock = createLock();
  const log: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const first = lock(async () => {
    log.push("1 start");
    await gate;
    log.push("1 end");
    throw new Error("boom");
  });
  const rest = [2, 3].map((n) => lock(async () => void log.push(String(n))));

  await Bun.sleep(5);
  expect(log).toEqual(["1 start"]); // the others wait for the first to settle
  release();
  await expect(first).rejects.toThrow("boom");
  await Promise.all(rest);
  expect(log).toEqual(["1 start", "1 end", "2", "3"]);
});
