import { Download } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import type { useDownloads } from "../useDownloads";
import DownloadRow from "./DownloadRow";

/** The error / loading / empty / list body. `canEdit` is false while read-only. */
export default function DownloadList({
  d: { queue, rows, cancel, remove },
  canEdit,
}: {
  d: ReturnType<typeof useDownloads>;
  canEdit: boolean;
}) {
  if (queue.isError)
    return (
      <ErrorState
        title="Couldn't read the download queue"
        message={queue.error.message}
        onRetry={() => void queue.refetch()}
      />
    );
  if (queue.isPending)
    return <LoadingState label="Reading the download queue…" />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={Download}
        title="The download queue is empty"
        description="Items the browser extension sends to the server show up here."
      />
    );
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <DownloadRow
          key={row.id}
          row={row}
          onCancel={canEdit ? (id) => cancel.mutate({ id }) : undefined}
          onRemove={canEdit ? (id) => remove.mutate({ ids: [id] }) : undefined}
        />
      ))}
    </ul>
  );
}
