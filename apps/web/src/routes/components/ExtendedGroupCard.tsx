import type { ContentServerType, GroupType } from "@tagapp/utils/types";
import { useAtomValue, useSetAtom } from "jotai";
import { Unlink } from "lucide-react";
import { memo } from "react";
import { clearFilterForNavigationAtom, tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import GroupCard from "@/components/craft/library/GroupCard";
import { Button } from "@/components/ui/button";
import { useGroupCover } from "@/hooks/useGroupCover";

/** Group card of the library: opens the group; the only action is Disband (hidden without the extension). */
const ExtendedGroupCard = memo(
  ({
    group,
    items,
    onDisband,
  }: {
    group: GroupType;
    /** The group's children. */
    items: ContentServerType[];
    onDisband: (id: string) => void;
  }) => {
    const tags = useAtomValue(tagsAtom);
    const clearFilter = useSetAtom(clearFilterForNavigationAtom);
    const cover = useGroupCover()(group, items);
    const name = group.title || group.id;

    return (
      <GroupCard
        group={group}
        count={items.length}
        cover={cover}
        onOpen={clearFilter}
        actions={
          tags ? (
            <Button
              variant="ghost"
              size="xs"
              title="Remove the group and keep its items"
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
              Disband
            </Button>
          ) : undefined
        }
      />
    );
  },
);

ExtendedGroupCard.displayName = "ExtendedGroupCard";
export default ExtendedGroupCard;
