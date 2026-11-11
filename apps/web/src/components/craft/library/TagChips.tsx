import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_GROUPS = 3;
const MAX_PER_GROUP = 6;

const pretty = (s: string) => s.replaceAll("_", " ");

const toRows = (tags: string[]) => {
  const map = new Map<string, string[]>();
  for (const tag of [...tags].sort()) {
    const parent = tag.split(":")[0] as string;
    map.set(parent, [...(map.get(parent) ?? []), tag]);
  }
  return [...map.entries()].map(([parent, list]) => ({
    parent,
    // A tag without a colon is its own group; show it whole
    values: list.map((t) => ({
      tag: t,
      label: t === parent ? t : t.slice(parent.length + 1),
    })),
  }));
};

type Row = ReturnType<typeof toRows>[number];

/**
 * Tags grouped by parent (the part before the colon): a quiet label, then the values as chips.
 * Without `limit` every tag is shown; with it the list collapses behind one "Show N more".
 * `extra` (a group card's children's tags) is a second section under a divider: it only gets the
 * rows the collapsed limit leaves after `tags`, and tags already in `tags` are not repeated.
 */
export default function TagChips({
  tags,
  extra,
  limit = false,
}: {
  tags: string[];
  extra?: string[];
  limit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const [main, more] = useMemo(
    () => [toRows(tags), toRows(extra?.filter((t) => !tags.includes(t)) ?? [])],
    [tags, extra],
  );

  const total = [...main, ...more].reduce((n, r) => n + r.values.length, 0);
  if (!total) return <p className="text-xs text-muted-foreground">No tags</p>;

  const collapsed = limit && !expanded;
  let budget = MAX_GROUPS; // rows left, shared by both sections
  const take = (rows: Row[]) => {
    if (!collapsed) return rows;
    const kept = rows.slice(0, budget).map((g) => ({
      ...g,
      values: g.values.slice(0, MAX_PER_GROUP),
    }));
    budget -= kept.length;
    return kept;
  };
  const shown = [take(main), take(more)];
  const hiddenTags =
    total - shown.flat().reduce((n, r) => n + r.values.length, 0);

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {shown.map(
        (rows, i) =>
          rows.length > 0 && (
            <div
              key={i === 0 ? "tags" : "extra"}
              className={cn(
                "grid grid-cols-1 gap-1.5",
                i === 1 && shown[0]?.length && "border-t pt-1.5",
              )}
            >
              {rows.map((g) => (
                <div key={g.parent} className="flex items-start gap-2">
                  <span
                    title={pretty(g.parent)}
                    className="w-[4.5rem] shrink-0 truncate pt-0.5 text-[11px] leading-4 text-muted-foreground"
                  >
                    {pretty(g.parent)}
                  </span>
                  <ul className="flex min-w-0 flex-wrap gap-1">
                    {g.values.map((v) => (
                      <li
                        key={v.tag}
                        className="max-w-full border bg-muted/50 px-1.5 py-0.5 text-[11px] leading-4 [overflow-wrap:anywhere]"
                      >
                        {pretty(v.label)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ),
      )}
      {limit && (hiddenTags > 0 || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="w-fit cursor-pointer text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {expanded ? "Show fewer tags" : `Show ${hiddenTags} more`}
        </button>
      )}
    </div>
  );
}
