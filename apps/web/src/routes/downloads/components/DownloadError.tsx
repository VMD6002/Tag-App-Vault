import { useState } from "react";
import { cn } from "@/lib/utils";

/** The failure message, clamped to 3 lines; click to read all of it. */
export default function DownloadError({ error }: { error: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      title={open ? "Show less" : "Show the whole error"}
      onClick={() => setOpen(!open)}
      className={cn(
        "cursor-pointer text-left text-xs text-destructive [overflow-wrap:anywhere]",
        !open && "line-clamp-3",
      )}
    >
      {error}
    </button>
  );
}
