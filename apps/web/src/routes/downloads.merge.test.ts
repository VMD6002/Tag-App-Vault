import { expect, test } from "bun:test";
import type { DownloadTask } from "@tagapp/api";
import { mergeRows } from "./downloads.merge";

const task = (id: string, status: DownloadTask["status"]): DownloadTask => ({
  id,
  title: id,
  scraper: "s",
  status,
  percent: 50,
  speed: "1MiB/s",
  eta: "00:01",
});

test("queue items without a task are idle, tasks win, finished tasks follow", () => {
  const queue = [
    { id: "a", title: "A", scraper: "s" },
    { id: "b", title: "B", scraper: "s" },
  ];
  const rows = mergeRows(queue, [
    task("b", "downloading"),
    task("c", "completed"),
  ]);
  expect(rows.map((r) => [r.id, r.status])).toEqual([
    ["a", "idle"],
    ["b", "downloading"],
    ["c", "completed"],
  ]);
});
