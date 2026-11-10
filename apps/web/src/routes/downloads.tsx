import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Download, FileText, RefreshCw, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import TitleHeader from "@/components/craft/TitleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import ErrorLogDialog from "./components/ErrorLogDialog";
import { type DownloadRow, mergeRows } from "./downloads.merge";

const STATUS: Record<
  DownloadRow["status"],
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
const REMOVABLE = new Set<DownloadRow["status"]>([
  "idle",
  "failed",
  "cancelled",
]);

function Row({
  row,
  onCancel,
  onRemove,
}: {
  row: DownloadRow;
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

export default function DownloadsPage() {
  const tags = useAtomValue(tagsAtom);

  const queue = useQuery({
    ...orpc.downloads.getQueue.queryOptions(),
    refetchOnMount: "always",
  });
  // The stream keeps only the latest snapshot. It closes on unmount (gcTime 0 drops the query, so a
  // remount reconnects); on a stream error React Query retries with its backoff (1 s, 2 s, ... 4 times).
  const live = useQuery(
    orpc.downloads.watch.experimental_liveOptions({
      retry: 4,
      gcTime: 0,
      refetchOnMount: "always",
    }),
  );
  const snapshot = live.data;
  const running = snapshot?.running ?? false;

  // A status change that ends a run or a task leaves the queue file different: reread it
  const finished = snapshot?.tasks.filter(
    (t) => t.status === "completed" || t.status === "failed",
  ).length;
  const signature = snapshot && `${snapshot.running}:${finished}`;
  const last = useRef(signature);
  const { refetch: refetchQueue } = queue;
  useEffect(() => {
    if (last.current !== undefined && signature !== last.current)
      void refetchQueue();
    last.current = signature;
  }, [signature, refetchQueue]);

  // A failed task appended to error.log: mark it stale (refetches it when the dialog is open)
  const queryClient = useQueryClient();
  const failedCount = snapshot?.tasks.filter(
    (t) => t.status === "failed",
  ).length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: run when the failed count changes
  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: orpc.downloads.getErrorLog.key(),
    });
  }, [failedCount, queryClient]);
  const [logOpen, setLogOpen] = useState(false);

  const start = useMutation(
    orpc.downloads.start.mutationOptions({
      onSuccess: ({ started }) => {
        if (!started)
          toast(
            "Nothing started: the queue is empty or a run is already going",
          );
      },
      onError: () => toast.error("Couldn't start, check console for error"),
    }),
  );

  const cancel = useMutation(
    orpc.downloads.cancel.mutationOptions({
      onError: (e) => toast.error(`Couldn't cancel: ${e.message}`),
    }),
  );
  const remove = useMutation(
    orpc.downloads.remove.mutationOptions({
      onSuccess: () => void refetchQueue(),
      onError: (e) => toast.error(`Couldn't remove: ${e.message}`),
    }),
  );

  const rows = useMemo(
    () => mergeRows(queue.data ?? [], snapshot?.tasks ?? []),
    [queue.data, snapshot?.tasks],
  );

  const clearable = rows
    .filter((r) => r.status === "failed" || r.status === "cancelled")
    .map((r) => r.id);
  const clearFailed = () =>
    confirm
      .destructive({
        title: "Clear failed items?",
        description: `${clearable.length} failed or cancelled ${clearable.length === 1 ? "item" : "items"} will be removed from the queue. Files of a failed import move to Sync, where you can fix or delete them; incomplete downloads are deleted.`,
        confirmText: "Clear",
      })
      .then((ok) => {
        if (ok) remove.mutate({ ids: clearable });
      });

  return (
    <>
      <TitleHeader
        Title="Downloads"
        description={
          tags
            ? "The server's download queue. Finished items go straight into the library; failed ones stay here."
            : "The server's download queue. Starting downloads shows up when the TagApp browser extension is connected."
        }
      >
        <Button
          variant="outline"
          size="sm"
          disabled={queue.isFetching}
          onClick={() => void refetchQueue()}
          title="Read the queue again"
        >
          <RefreshCw className={queue.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogOpen(true)}
          title="Failures recorded in Download/error.log"
        >
          <FileText />
          Error log
        </Button>
        {!!tags && running && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({})}
            title="Stops queued and downloading items; importing ones finish"
          >
            Cancel all
          </Button>
        )}
        {!!tags && clearable.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={remove.isPending}
            onClick={() => void clearFailed()}
          >
            Clear failed
          </Button>
        )}
        {!!tags && (
          <Button
            size="sm"
            disabled={running || start.isPending}
            onClick={() => start.mutate({})}
          >
            {running ? "Downloading…" : "Start downloads"}
          </Button>
        )}
      </TitleHeader>
      <ErrorLogDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        canClear={!!tags}
      />
      {live.isError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Live progress is unavailable: {live.error.message}{" "}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => void live.refetch()}
          >
            Reconnect
          </button>
        </p>
      )}
      {queue.isError ? (
        <ErrorState
          title="Couldn't read the download queue"
          message={queue.error.message}
          onRetry={() => void refetchQueue()}
        />
      ) : queue.isPending ? (
        <LoadingState label="Reading the download queue…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Download}
          title="The download queue is empty"
          description="Items the browser extension sends to the server show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              onCancel={tags ? (id) => cancel.mutate({ id }) : undefined}
              onRemove={tags ? (id) => remove.mutate({ ids: [id] }) : undefined}
            />
          ))}
        </ul>
      )}
    </>
  );
}
