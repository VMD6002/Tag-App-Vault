import type { DownloadTask } from "@tagapp/api";

export type DownloadRow = Omit<DownloadTask, "status"> & {
  /** `idle`: queued but no run has touched it since the server started. */
  status: DownloadTask["status"] | "idle";
};

type QueueItem = { id: string; title: string; scraper: string };

/** Queue order first (task state where a run has one), then tasks that already left the queue (completed). */
export function mergeRows(
  queue: QueueItem[],
  tasks: DownloadTask[],
): DownloadRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const inQueue = new Set(queue.map((q) => q.id));
  return [
    ...queue.map(
      (q): DownloadRow =>
        byId.get(q.id) ?? {
          ...q,
          status: "idle",
          percent: 0,
          speed: "",
          eta: "",
        },
    ),
    ...tasks.filter((t) => !inQueue.has(t.id)),
  ];
}
