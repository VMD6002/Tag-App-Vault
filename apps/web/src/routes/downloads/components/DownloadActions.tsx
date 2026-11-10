import { FileText, RefreshCw } from "lucide-react";
import { confirm } from "@/components/craft/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { useDownloads } from "../useDownloads";

/** Header buttons. `canEdit` is false while read-only (no extension connected). */
export default function DownloadActions({
  d: { live, running, rows, start, cancel, remove, clearFinished },
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

  const finished = rows.filter((r) => r.status === "completed").length;
  const clearDone = () =>
    confirm
      .destructive({
        title: "Clear finished downloads?",
        description: `${finished} completed ${finished === 1 ? "download" : "downloads"} will be removed from this list. The items stay in the library.`,
        confirmText: "Clear",
      })
      .then((ok) => {
        if (ok) clearFinished.mutate({});
      });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={live.isFetching}
        onClick={() => void live.refetch()}
        title="Reconnect to the server"
      >
        <RefreshCw className={live.isFetching ? "animate-spin" : ""} />
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
      {canEdit && finished > 0 && (
        <Button
          variant="outline"
          size="sm"
          disabled={clearFinished.isPending}
          onClick={() => void clearDone()}
          title="Removes completed entries from the history; the library is untouched"
        >
          Clear finished
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
