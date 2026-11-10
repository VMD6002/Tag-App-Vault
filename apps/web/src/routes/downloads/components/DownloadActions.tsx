import { FileText, RefreshCw } from "lucide-react";
import { confirm } from "@/components/craft/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { useDownloads } from "../useDownloads";

/** Header buttons. `canEdit` is false while read-only (no extension connected). */
export default function DownloadActions({
  d: { queue, running, rows, start, cancel, remove },
  canEdit,
  onOpenLog,
}: {
  d: ReturnType<typeof useDownloads>;
  canEdit: boolean;
  onOpenLog: () => void;
}) {
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
      <Button
        variant="outline"
        size="sm"
        disabled={queue.isFetching}
        onClick={() => void queue.refetch()}
        title="Read the queue again"
      >
        <RefreshCw className={queue.isFetching ? "animate-spin" : ""} />
        Refresh
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenLog}
        title="Failures recorded in Download/error.log"
      >
        <FileText />
        Error log
      </Button>
      {canEdit && running && (
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
      {canEdit && clearable.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          disabled={remove.isPending}
          onClick={() => void clearFailed()}
        >
          Clear failed
        </Button>
      )}
      {canEdit && (
        <Button
          size="sm"
          disabled={running || start.isPending}
          onClick={() => start.mutate({})}
        >
          {running ? "Downloading…" : "Start downloads"}
        </Button>
      )}
    </>
  );
}
