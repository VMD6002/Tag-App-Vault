import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function FilterField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label className="text-xs text-muted-foreground">
        {label} <span className="font-normal">{hint}</span>
      </Label>
      {children}
    </div>
  );
}

export function FilterPanel({
  search,
  onSearchChange,
  onApply,
  onClear,
  activeCount,
  realtime,
  onRealtimeChange,
  extra,
  children,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
  /** Number of filters currently set (search counts as one). */
  activeCount: number;
  /** Re-filter live as the search and filters change. */
  realtime: boolean;
  onRealtimeChange: (v: boolean) => void;
  /** Row under the fields (the library's advanced search); it brings its own placement classes. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Small screens: search, fields, then Realtime + Filter, then the clear row. From sm: actions sit right of the search.
    <section
      aria-label="Filters"
      className="grid gap-3 border bg-card/40 p-3 sm:grid-cols-[1fr_auto]"
    >
      <div className="relative min-w-0 sm:row-start-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
          placeholder="Search titles…"
          aria-label="Search titles"
          className="pl-8"
        />
      </div>
      <div className="order-3 flex items-center gap-2 sm:order-none sm:row-start-1 sm:justify-end">
        <Label htmlFor="realtime-filter-switch" className="text-sm">
          Realtime
        </Label>
        <Switch
          id="realtime-filter-switch"
          checked={realtime}
          onCheckedChange={onRealtimeChange}
        />
        <Button
          onClick={onApply}
          title="Apply the search and tag filters"
          className="ml-auto sm:ml-0"
        >
          Filter
        </Button>
      </div>
      <div className="order-2 grid gap-3 sm:order-none sm:col-span-2 sm:row-start-2 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
      {extra}
      {activeCount > 0 && (
        <div
          className={cn(
            "order-4 flex items-center justify-between gap-3 border-t pt-2 text-xs text-muted-foreground sm:order-none sm:col-span-2",
            extra ? "sm:row-start-4" : "sm:row-start-3",
          )}
        >
          <span>
            {activeCount} {activeCount === 1 ? "filter" : "filters"} set.
            {realtime ? "" : " Press Filter to apply."}
          </span>
          <Button variant="ghost" size="xs" onClick={onClear}>
            <X />
            Clear filters
          </Button>
        </div>
      )}
    </section>
  );
}

/** Sticky strip under the nav: result count / selection on the left, sort on the right. */
export function ResultsBar({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
