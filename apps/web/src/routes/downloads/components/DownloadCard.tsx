import { getCoverUrl } from "@/lib/coverUrl";
import type { useDownloads } from "../useDownloads";
import DownloadCardActions from "./DownloadCardActions";
import DownloadCover from "./DownloadCover";
import DownloadDates from "./DownloadDates";
import DownloadError from "./DownloadError";
import { type Row, statusLine } from "./status";

/** `canEdit` is false while read-only: no actions. */
export default function DownloadCard({
  row,
  d,
  canEdit,
}: {
  row: Row;
  d: ReturnType<typeof useDownloads>;
  canEdit: boolean;
}) {
  // A completed item still in the library links to its page and shows its local cover
  const item = row.status === "completed" ? d.library?.[row.id] : undefined;
  const local = item && getCoverUrl(item);
  const url = item && `#/${item.type}/${item.id}`;
  const line = statusLine(row);
  const cover = (
    <DownloadCover row={row} src={local ? `/${local}` : (row.cover ?? null)} />
  );

  return (
    <li className="flex h-full flex-col border bg-card/40 transition-colors hover:border-foreground/30">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" tabIndex={-1}>
          {cover}
        </a>
      ) : (
        cover
      )}
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title={`Open ${row.title} in a new tab`}
              className="block text-sm leading-snug font-semibold [overflow-wrap:anywhere] hover:underline focus-visible:underline"
            >
              {row.title}
            </a>
          ) : (
            <p className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">
              {row.title}
            </p>
          )}
          <p
            title={`ID: ${row.id}`}
            className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
          >
            {row.id}
          </p>
        </div>
        {line && (
          <p className="text-xs tabular-nums text-muted-foreground">{line}</p>
        )}
        {row.error && <DownloadError error={row.error} />}
        <DownloadDates row={{ ...row, added: item ? row.added : undefined }} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-1.5">
        <span className="truncate text-[11px] text-muted-foreground">
          {row.scraper}
        </span>
        {canEdit && <DownloadCardActions row={row} d={d} />}
      </div>
    </li>
  );
}
