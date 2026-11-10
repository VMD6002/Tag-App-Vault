import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import { LoadingState } from "@/components/craft/EmptyState";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

/** `Download/error.log` of the server, newest at the bottom. `canClear` is false while read-only. */
export default function ErrorLogDialog({
  open,
  onClose,
  canClear,
}: {
  open: boolean;
  onClose: () => void;
  canClear: boolean;
}) {
  // Reread on every open; the page invalidates this query when a task fails
  const log = useQuery({
    ...orpc.downloads.getErrorLog.queryOptions(),
    enabled: open,
    refetchOnMount: "always",
  });
  const clear = useMutation(
    orpc.downloads.clearErrorLog.mutationOptions({
      onSuccess: () => void log.refetch(),
      onError: (e) => toast.error(`Couldn't clear the log: ${e.message}`),
    }),
  );

  const text = log.data?.text;
  const pre = useRef<HTMLPreElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the end whenever the text changes
  useEffect(() => {
    pre.current?.scrollTo({ top: pre.current.scrollHeight });
  }, [text, open]);

  const onClear = () =>
    confirm
      .destructive({
        title: "Clear the error log?",
        description:
          "Download/error.log is deleted. Failed items stay in the queue; only their log entries go.",
        confirmText: "Clear log",
      })
      .then((ok) => {
        if (ok) clear.mutate({});
      });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Error log"
      description="Download failures the server recorded (Download/error.log)."
      className="sm:max-w-3xl"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={log.isFetching}
            onClick={() => void log.refetch()}
          >
            <RefreshCw className={log.isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          {canClear && (
            <Button
              variant="destructive"
              size="sm"
              disabled={clear.isPending || !text}
              onClick={() => void onClear()}
            >
              Clear log
            </Button>
          )}
        </>
      }
    >
      {log.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn't read the error log: {log.error.message}
        </p>
      ) : text === undefined ? (
        <LoadingState label="Reading the error log…" />
      ) : text === "" ? (
        <p className="text-sm text-muted-foreground">The error log is empty.</p>
      ) : (
        <>
          {log.data?.truncated && (
            <p className="text-xs text-muted-foreground">
              Only the last 1 MB is shown; older entries are cut.
            </p>
          )}
          <pre
            ref={pre}
            className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words border bg-muted/40 p-3 font-mono text-xs"
          >
            {text}
          </pre>
        </>
      )}
    </ModalShell>
  );
}
