import { useMemo, useState } from "react";

const MAX_GROUPS = 3;
const MAX_PER_GROUP = 6;

const pretty = (s: string) => s.replaceAll("_", " ");

/**
 * Tags grouped by parent (the part before the colon): a quiet label, then the values as chips.
 * Without `limit` every tag is shown; with it the list collapses behind "Show N more".
 */
export default function TagChips({
  tags,
  limit = false,
}: {
  tags: string[];
  limit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tag of [...tags].sort()) {
      const parent = tag.split(":")[0] as string;
      map.set(parent, [...(map.get(parent) ?? []), tag]);
    }
    return [...map.entries()].map(([parent, list]) => ({
      parent,
      // A tag without a colon is its own group; show it whole
      values: list.map((t) => (t === parent ? t : t.slice(parent.length + 1))),
    }));
  }, [tags]);

  if (!tags.length)
    return <p className="text-xs text-muted-foreground">No tags</p>;

  const collapsed = limit && !expanded;
  const shownGroups = collapsed ? groups.slice(0, MAX_GROUPS) : groups;
  const rows = shownGroups.map((g) => ({
    ...g,
    values: collapsed ? g.values.slice(0, MAX_PER_GROUP) : g.values,
  }));
  const hiddenTags =
    tags.length - rows.reduce((n, r) => n + r.values.length, 0);

  return (
    <div className="grid grid-cols-1 gap-1.5">
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
                key={v}
                className="max-w-full border bg-muted/50 px-1.5 py-0.5 text-[11px] leading-4 [overflow-wrap:anywhere]"
              >
                {pretty(v)}
              </li>
            ))}
          </ul>
        </div>
      ))}
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
