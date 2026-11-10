import { Download } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import type { useDownloads } from "../useDownloads";
import DownloadCard from "./DownloadCard";
import DownloadSection from "./DownloadSection";
import type { Row } from "./status";

const GROUPS: [string, (r: Row) => boolean][] = [
  [
    "Active and queued",
    (r) => ["queued", "downloading", "importing"].includes(r.status),
  ],
  [
    "Failed and cancelled",
    (r) => r.status === "failed" || r.status === "cancelled",
  ],
  ["Finished", (r) => r.status === "completed"],
];

/** The error / loading / empty states, else the cards in sections. `canEdit` is false while read-only. */
export default function DownloadList({
  d,
  canEdit,
}: {
  d: ReturnType<typeof useDownloads>;
  canEdit: boolean;
}) {
  const { live, rows } = d;
  if (live.isError && !live.data)
    return (
      <ErrorState
        title="Couldn't read the download queue"
        message={live.error.message}
        onRetry={() => void live.refetch()}
      />
    );
  if (live.isPending)
    return <LoadingState label="Reading the download queue…" />;
  if (rows.length === 0)
    return (
      <EmptyState
        icon={Download}
        title="The download queue is empty"
        description="Items the browser extension sends to the server show up here."
      />
    );
  return GROUPS.map(([title, match]) => {
    const group = rows.filter(match);
    return (
      group.length > 0 && (
        <DownloadSection key={title} title={title} count={group.length}>
          {group.map((row) => (
            <DownloadCard key={row.id} row={row} d={d} canEdit={canEdit} />
          ))}
        </DownloadSection>
      )
    );
  });
}
