import { Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DownloadRow as Row } from "../merge";

const STATUS: Record<
  Row["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  idle: { label: "Queued, not started", variant: "outline" },
  queued: { label: "Queued", variant: "outline" },
  downloading: { label: "Downloading", variant: "default" },
  importing: { label: "Importing", variant: "default" },
  completed: { label: "In the library", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

// Not part of a run's active work: safe to drop from the queue
const REMOVABLE = new Set<Row["status"]>(["idle", "failed", "cancelled"]);

export default function DownloadRow({
  row,
  onCancel,
  onRemove,
}: {
  row: Row;
  /** Both are undefined while read-only. */
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const { label, variant } = STATUS[row.status];
  const live = row.status === "downloading" || row.status === "importing";
  return (
    <li className="flex flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words font-medium">{row.title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {row.scraper}
          <Badge variant={variant}>{label}</Badge>
          {onCancel &&
            (row.status === "queued" || row.status === "downloading") && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onCancel(row.id)}
              >
                <Square /> Cancel
              </Button>
            )}
          {onRemove && REMOVABLE.has(row.status) && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => onRemove(row.id)}
              title="Remove from the queue"
            >
              <Trash2 /> Remove
            </Button>
          )}
        </span>
      </div>
      {row.status !== "idle" && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <div
            role="progressbar"
            aria-label={`${row.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(row.percent)}
            className="h-1.5 flex-1 bg-muted"
          >
            <div
              className={`h-full ${row.status === "failed" ? "bg-destructive" : row.status === "cancelled" ? "bg-muted-foreground" : "bg-primary"}`}
              style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }}
            />
          </div>
          <span className="w-10 text-right">{Math.round(row.percent)}%</span>
          {live && (
            <span>
              {row.speed} · ETA {row.eta}
            </span>
          )}
        </div>
      )}
      {row.error && <p className="text-sm text-destructive">{row.error}</p>}
    </li>
  );
}
