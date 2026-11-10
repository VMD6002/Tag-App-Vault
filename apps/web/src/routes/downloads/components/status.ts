import type { DownloadTask } from "@tagapp/api";

export type Row = DownloadTask;

export const STATUS_LABEL: Record<Row["status"], string> = {
  queued: "Queued",
  downloading: "Downloading",
  importing: "Importing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The text under the title: live numbers, or why the bar stopped. */
export function statusLine(row: Row) {
  const pct = `${Math.round(row.percent)}%`;
  switch (row.status) {
    case "queued":
      return "Waiting in the queue";
    case "downloading":
      return `${pct} · ${row.speed || "…"} · ETA ${row.eta}`;
    case "importing":
      return "Importing into the library…";
    case "failed":
    case "cancelled":
      return `Stopped at ${pct}`;
    case "completed":
      return null;
  }
}
