import { Search, SearchX } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/craft/EmptyState";
import { Input } from "@/components/ui/input";

const pretty = (s: string) => s.replaceAll("_", " ");

export function TagSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Find a tag…"
        aria-label="Find a tag"
        className="pl-8"
      />
    </div>
  );
}

/**
 * Tags grouped by their parent (the part before the colon), one block per group.
 * `tags` is the server's tag -> item count map. `query` is a client-side filter only.
 * `covers` (when the extension sent them) show above the tag row, like the extension's tags page.
 */
export function TagGroups({
  tags,
  query,
  covers,
}: {
  tags: Record<string, number>;
  query: string;
  /** Tag -> cover URL from the extension; tags without one look plain. */
  covers?: Record<string, string>;
}) {
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, string[]>();
    for (const tag of Object.keys(tags).sort()) {
      if (q && !tag.toLowerCase().includes(q)) continue;
      const parent = tag.split(":")[0] as string;
      map.set(parent, [...(map.get(parent) ?? []), tag]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tags, query]);

  if (!groups.length)
    return query.trim() ? (
      <EmptyState
        icon={SearchX}
        title={`No tags match "${query.trim()}"`}
        description="Check the spelling or try a shorter search."
        className="py-10"
      />
    ) : (
      <EmptyState
        title="No tags yet"
        description="Tags appear here once items in the library use them."
        className="py-10"
      />
    );

  return (
    <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
      {groups.map(([parent, list]) => (
        <section key={parent} className="mb-8 break-inside-avoid">
          <h2 className="mb-1 flex items-baseline justify-between gap-2 border-b pb-1.5 text-sm font-semibold">
            <span className="min-w-0 truncate" title={parent}>
              {pretty(parent)}
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
              {list.length} {list.length === 1 ? "tag" : "tags"}
            </span>
          </h2>
          <ul>
            {list.map((tag) => {
              const count = tags[tag] ?? 0;
              const cover = covers?.[tag];
              return (
                <li key={tag} className="py-0.5">
                  {cover && (
                    <img
                      alt={`${tag} cover`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="mb-1 max-h-32 w-full border bg-muted/40 object-contain"
                      src={cover}
                    />
                  )}
                  <div className="flex items-center gap-2 hover:bg-muted/60">
                    <span
                      className="min-w-0 flex-1 truncate py-1 pl-2 text-sm"
                      title={tag}
                    >
                      {pretty(
                        tag === parent ? tag : tag.slice(parent.length + 1),
                      )}
                    </span>
                    <span
                      className={`pr-2 text-xs tabular-nums ${count ? "text-muted-foreground" : "text-destructive"}`}
                      title={`${count} ${count === 1 ? "item" : "items"}${count ? "" : " (unused)"}`}
                    >
                      {count}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
