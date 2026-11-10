import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { mergeRows } from "./merge";

/** Queue + live task state merged into rows, the effects that keep them fresh, and the mutations. */
export function useDownloads() {
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

  return { queue, live, running, rows, start, cancel, remove };
}
