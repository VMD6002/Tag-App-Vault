import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { tagsAtom } from "@/atom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import TitleHeader from "@/components/craft/TitleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
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
};

function Row({ row }: { row: DownloadRow }) {
  const { label, variant } = STATUS[row.status];
  const live = row.status === "downloading" || row.status === "importing";
  return (
    <li className="flex flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words font-medium">{row.title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {row.scraper}
          <Badge variant={variant}>{label}</Badge>
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
              className={`h-full ${row.status === "failed" ? "bg-destructive" : "bg-primary"}`}
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

  const rows = useMemo(
    () => mergeRows(queue.data ?? [], snapshot?.tasks ?? []),
    [queue.data, snapshot?.tasks],
  );

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
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </>
  );
}
