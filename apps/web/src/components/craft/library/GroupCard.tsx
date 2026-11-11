import type { GroupType } from "@tagapp/utils/types";
import { Folder } from "lucide-react";
import { memo, type ReactNode, useState } from "react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import TagChips from "./TagChips";

type Props = {
  group: GroupType;
  /** Number of items in the group. */
  count: number;
  /** Cover URL; null for none (also shown when it fails to load). */
  cover: string | null;
  /** Runs before navigating to the group page (the library clears its filters there). */
  onOpen?: () => void;
  /** Group lists with selection: a click toggles instead of opening. */
  selection?: { on: boolean; selected: boolean; onToggle: () => void };
  /** Tags of the group's children, shown after its own (own tags are outlined). */
  childTags?: string[];
  /** Footer buttons; the footer only renders with some. */
  actions?: ReactNode;
};

/** Card of a group (library, `/group`): cover, title, item count, tags. Clicking opens `/group/:id`. */
const GroupCard = memo(
  ({ group, count, cover, childTags, onOpen, selection, actions }: Props) => {
    const selectionOn = !!selection?.on;
    const selected = !!selection?.selected;
    const href = `/group/${encodeURIComponent(group.id)}`;
    const [failedCover, setFailedCover] = useState<string | null>(null);
    const shownCover = cover !== failedCover ? cover : null;
    const open = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectionOn) {
        e.preventDefault();
        selection?.onToggle();
      } else onOpen?.();
    };

    return (
      <article
        onClick={() => selectionOn && selection?.onToggle()}
        className={cn(
          "group/card relative flex h-fit flex-col border bg-card/40 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_24rem]",
          selected
            ? "border-foreground ring-1 ring-foreground"
            : "hover:border-foreground/30",
          selectionOn && "cursor-pointer",
        )}
      >
        <Link
          href={href}
          onClick={open}
          aria-label={`Open group ${group.title || group.id}`}
          className="relative flex min-h-32 items-center justify-center overflow-hidden border-b bg-muted/40"
        >
          {shownCover ? (
            <img
              loading="lazy"
              className="max-h-72 w-full object-contain"
              src={shownCover}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedCover(shownCover)}
            />
          ) : (
            <div
              className="h-32 w-full bg-black"
              role="img"
              aria-label="No cover"
            />
          )}
          <span className="absolute right-2 bottom-2 flex items-center gap-1 border bg-background/90 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
            <Folder className="size-3" aria-hidden />
            Group · {count} {count === 1 ? "item" : "items"}
          </span>
          {selectionOn && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => selection?.onToggle()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${group.title || group.id}`}
              className="absolute top-2 left-2 size-5 bg-background/90"
            />
          )}
        </Link>

        <div className="grid grid-cols-1 gap-3 p-3">
          <div className="min-w-0">
            <Link
              href={href}
              onClick={open}
              className="block text-sm leading-snug font-semibold [overflow-wrap:anywhere] hover:underline focus-visible:underline"
            >
              {group.title || group.id}
            </Link>
            <p
              title={`ID: ${group.id}`}
              className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
            >
              {group.id}
            </p>
          </div>
          <TagChips
            tags={
              childTags
                ? [...new Set([...group.tags, ...childTags])]
                : group.tags
            }
            own={childTags ? group.tags : undefined}
            limit
          />
        </div>

        {actions && (
          <div className="mt-auto flex items-center justify-end gap-0.5 border-t px-3 py-1.5">
            {actions}
          </div>
        )}
      </article>
    );
  },
);

GroupCard.displayName = "GroupCard";
export default GroupCard;
