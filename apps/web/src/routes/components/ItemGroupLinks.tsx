import type { GroupsDB } from "@tagapp/utils/types";
import { useSetAtom } from "jotai";
import { Link } from "wouter";
import { clearFilterForNavigationAtom } from "@/atom";
import { cn } from "@/lib/utils";

/**
 * One group of an item: a link to `/group/:id` titled with the group's title. An id without a record
 * (yet) has no page, so it is plain text with the id.
 */
export function GroupLink({
  id,
  groups,
  className,
}: {
  id: string;
  groups: GroupsDB;
  className?: string;
}) {
  const clearFilter = useSetAtom(clearFilterForNavigationAtom);
  const group = groups[id];
  const classes = cn("min-w-0 [overflow-wrap:anywhere]", className);
  if (!group)
    return (
      <span title="No group record with this id yet" className={classes}>
        {id}
      </span>
    );
  return (
    <Link
      href={`/group/${encodeURIComponent(id)}`}
      onClick={clearFilter}
      className={cn(classes, "hover:underline")}
    >
      {group.title || id}
    </Link>
  );
}

/** Read-only "Groups" row for item pages and `/sync`: the item's group ids as chips that link to the groups. */
export default function ItemGroupLinks({
  ids,
  groups,
}: {
  ids: string[];
  groups: GroupsDB;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-[4.5rem] shrink-0 truncate pt-0.5 text-[11px] leading-4 text-muted-foreground">
        Groups
      </span>
      <ul className="flex min-w-0 flex-wrap gap-1">
        {ids.map((id) => (
          <li
            key={id}
            className="max-w-full border bg-muted/50 px-1.5 py-0.5 text-[11px] leading-4"
          >
            <GroupLink id={id} groups={groups} />
          </li>
        ))}
      </ul>
    </div>
  );
}
