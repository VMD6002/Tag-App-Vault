import type { ContentServerType, GroupType } from "@tagapp/utils/types";
import { useAtomValue, useSetAtom } from "jotai";
import { Pencil, Unlink } from "lucide-react";
import { memo, useMemo } from "react";
import { clearFilterForNavigationAtom, tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import GroupCard from "@/components/craft/library/GroupCard";
import { Button } from "@/components/ui/button";

/** Group card of the library: opens the group; Edit and Disband icon buttons (hidden without the extension). Tags: its own plus its children's. */
const ExtendedGroupCard = memo(
  ({
    group,
    items,
    onEdit,
    onDisband,
  }: {
    group: GroupType;
    /** The group's children. */
    items: ContentServerType[];
    onEdit: (id: string) => void;
    onDisband: (id: string) => void;
  }) => {
    const tags = useAtomValue(tagsAtom);
    const clearFilter = useSetAtom(clearFilterForNavigationAtom);
    const name = group.title || group.id;
    const childTags = useMemo(
      () => [...new Set(items.flatMap((c) => c.tags))],
      [items],
    );

    return (
      <GroupCard
        group={group}
        count={items.length}
        cover={group.cover || null}
        childTags={childTags}
        onOpen={clearFilter}
        actions={
          tags ? (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Edit the title, tags, cover, description and id"
                aria-label={`Edit ${name}`}
                onClick={() => onEdit(group.id)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Remove the group and keep its items"
                aria-label={`Disband ${name}`}
                onClick={() =>
                  void confirm
                    .destructive({
                      title: "Disband this group?",
                      description: `"${name}" is removed and its ${items.length} ${items.length === 1 ? "item goes" : "items go"} back to the library. The items are kept.`,
                      confirmText: "Disband",
                    })
                    .then((ok) => {
                      if (ok) onDisband(group.id);
                    })
                }
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Unlink />
              </Button>
            </>
          ) : undefined
        }
      />
    );
  },
);

ExtendedGroupCard.displayName = "ExtendedGroupCard";
export default ExtendedGroupCard;
