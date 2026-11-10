import { ImageOff } from "lucide-react";
import { useState } from "react";
import { typeInfo } from "@/components/craft/library/ContentCard";
import { cn } from "@/lib/utils";
import { type Row, STATUS_LABEL } from "./status";

const BAR = {
  queued: "",
  downloading: "bg-primary",
  importing: "animate-pulse bg-primary",
  completed: "bg-primary",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground",
};

/** 16:9 cover with the status chip on top and the progress bar fused to its bottom edge. */
export default function DownloadCover({
  row,
  src,
}: {
  row: Row;
  /** Library cover, else the remote one; null when there is none. */
  src: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const Icon = row.type ? typeInfo[row.type].Icon : ImageOff;
  const percent = Math.min(100, Math.max(0, row.percent));
  const live = row.status === "downloading" || row.status === "importing";

  return (
    <div className="relative aspect-video overflow-hidden border-b bg-muted/40">
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt={`Cover of ${row.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/60">
          <Icon className="size-6" role="img" aria-label="No cover" />
          <span className="max-w-full truncate px-3 font-mono text-[11px]">
            {row.scraper}
          </span>
        </div>
      )}
      <span
        className={cn(
          "absolute top-2 left-2 flex items-center gap-1.5 border bg-background/90 px-1.5 py-0.5 text-[11px] leading-4",
          row.status === "failed" && "border-destructive/50 text-destructive",
        )}
      >
        {live && (
          <span className="size-1.5 animate-pulse bg-primary" aria-hidden />
        )}
        {STATUS_LABEL[row.status]}
      </span>
      {row.status !== "queued" && (
        <div
          role="progressbar"
          aria-label={`${row.title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="absolute inset-x-0 bottom-0 h-1.5 bg-background/70"
        >
          <div
            className={cn("h-full transition-[width]", BAR[row.status])}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
