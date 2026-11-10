import { Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useDownloads } from "../useDownloads";
import type { Row } from "./status";

/** Cancel, Remove or Clear, whichever the status allows. Nothing renders while read-only. */
export default function DownloadCardActions({
  row,
  d: { running, cancel, remove, clearFinished },
}: {
  row: Row;
  d: ReturnType<typeof useDownloads>;
}) {
  const { id, status, title } = row;
  if ((status === "queued" && running) || status === "downloading")
    return (
      <Button
        variant="ghost"
        size="xs"
        aria-label={`Cancel ${title}`}
        onClick={() => cancel.mutate({ id })}
      >
        <Square /> Cancel
      </Button>
    );
  if (status === "queued" || status === "failed" || status === "cancelled")
    return (
      <Button
        variant="ghost"
        size="xs"
        title="Remove from the queue"
        aria-label={`Remove ${title}`}
        onClick={() => remove.mutate({ ids: [id] })}
      >
        <Trash2 /> Remove
      </Button>
    );
  if (status === "completed")
    return (
      <Button
        variant="ghost"
        size="xs"
        title="Remove from this list; the item stays in the library"
        aria-label={`Clear ${title}`}
        onClick={() => clearFinished.mutate({ ids: [id] })}
      >
        <X /> Clear
      </Button>
    );
  return null;
}
