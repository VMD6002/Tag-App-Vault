import { groupTagStats } from "@tagapp/utils";
import type { ContentServerType, GroupType } from "@tagapp/utils/types";
import { useMemo } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";

/** Tag counts across the group's items (`groupTagStats`), most common first. */
export default function GroupStatsModal({
  open,
  onClose,
  group,
  items,
}: {
  open: boolean;
  onClose: () => void;
  group: GroupType;
  items: ContentServerType[];
}) {
  const rows = useMemo(
    () =>
      Object.entries(groupTagStats(items)).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    [items],
  );
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Group stats"
      description={`${group.title || group.id}: ${items.length} ${items.length === 1 ? "item" : "items"}, ${rows.length} different ${rows.length === 1 ? "tag" : "tags"}`}
      className="sm:max-w-lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {rows.length ? (
        <ul className="grid max-h-[60vh] gap-1 overflow-y-auto text-sm">
          {rows.map(([tag, count]) => (
            <li
              key={tag}
              className="relative flex justify-between gap-3 px-2 py-1"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-muted"
                style={{ width: `${(count / items.length) * 100}%` }}
              />
              <span className="relative min-w-0 [overflow-wrap:anywhere]">
                {tag}
              </span>
              <span className="relative text-muted-foreground tabular-nums">
                {count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          The items in this group have no tags.
        </p>
      )}
    </ModalShell>
  );
}
