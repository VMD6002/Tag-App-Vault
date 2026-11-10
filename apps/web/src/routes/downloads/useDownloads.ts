import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** The server's merged list (queue + history, live progress included), the effects that keep it fresh, and the mutations. */
export function useDownloads() {
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
  const rows = snapshot?.tasks ?? [];

  // Library items of the completed rows: their local cover and page (the remote cover is the fallback).
  // Refetched whenever the number of completed rows changes (a download just finished or was cleared).
  const completedCount = rows.filter((t) => t.status === "completed").length;
  const { data: library } = useQuery({
    queryKey: ["downloads", "library", completedCount],
    queryFn: () => orpc.main.getAllContent.call({}),
    enabled: completedCount > 0,
    gcTime: 0,
    retry: 0,
  });

  // A failed task appended to error.log: mark it stale (refetches it when the dialog is open)
  const queryClient = useQueryClient();
  const failedCount = rows.filter((t) => t.status === "failed").length;
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
      onError: (e) => toast.error(`Couldn't remove: ${e.message}`),
    }),
  );

  const clearFinished = useMutation(
    orpc.downloads.clearFinished.mutationOptions({
      onError: (e) => toast.error(`Couldn't clear: ${e.message}`),
    }),
  );

  return { live, running, rows, library, start, cancel, remove, clearFinished };
}
