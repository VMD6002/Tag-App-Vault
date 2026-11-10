import { formatDate } from "@/lib/formatDate";
import type { Row } from "./status";

const ENDED: Partial<Record<Row["status"], string>> = {
  completed: "Downloaded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Only the dates this item has: queued, started, ended, added to the library. */
export default function DownloadDates({ row }: { row: Row }) {
  const dates: [string, number | undefined][] = [
    ["Added to downloads", row.queuedAt],
    ["Started", row.startedAt],
    [ENDED[row.status] ?? "Finished", row.finishedAt],
    ["Added to library", row.added],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
      {dates.map(
        ([label, at]) =>
          at && (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd className="text-right tabular-nums">
                <time dateTime={new Date(at * 1000).toISOString()}>
                  {formatDate(at)}
                </time>
              </dd>
            </div>
          ),
      )}
    </dl>
  );
}
