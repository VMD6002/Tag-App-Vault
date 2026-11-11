import { VIEW_IN_LIBRARY_TAG } from "@tagapp/utils";
import type { GroupsDB } from "@tagapp/utils/types";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { Link } from "wouter";
import { clearFilterForNavigationAtom } from "@/atom";
import GroupPicker from "@/components/craft/GroupPicker";
import {
  updateIdAtom,
  updateModalOpenAtom,
  updateTagsAtom,
} from "@/components/craft/UpdateModal/atom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGroupActions } from "@/hooks/useGroupActions";
import { allContentAtom, allGroupsAtom } from "../atom";

/**
 * Item edit: the groups the item is in (link to the group, remove from it at once), a picker to add
 * it to more, and the `view:in-library` toggle, which only edits the tags box, saved with the item.
 * Group changes apply immediately; `onChanged` reloads the page's item and groups.
 */
export function ItemGroupsFieldView({
  item,
  groups,
  onChanged,
}: {
  item?: { id: string; groups?: string[] };
  groups: GroupsDB;
  onChanged: () => void;
}) {
  const [tags, setTags] = useAtom(updateTagsAtom);
  const setModalOpen = useSetAtom(updateModalOpenAtom);
  const clearFilter = useSetAtom(clearFilterForNavigationAtom);
  const { addToGroups, removeItems } = useGroupActions(onChanged);

  if (!item) return null;
  const ids = item.groups ?? [];
  const inLibrary = tags.some((t) => t.value === VIEW_IN_LIBRARY_TAG);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Groups</Label>
        {ids.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not in any group.</p>
        ) : (
          <ul className="grid gap-1">
            {ids.map((gid) => (
              <li
                key={gid}
                className="flex items-center justify-between gap-2 border bg-muted/30 px-2 py-1 text-sm"
              >
                <Link
                  href={`/group/${encodeURIComponent(gid)}`}
                  onClick={() => {
                    setModalOpen(false); // the modal's open state outlives the page
                    clearFilter();
                  }}
                  className="min-w-0 [overflow-wrap:anywhere] hover:underline"
                >
                  {groups[gid]?.title || gid}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Remove this item from the group"
                  aria-label={`Remove from ${groups[gid]?.title || gid}`}
                  onClick={() => void removeItems(gid, [item.id])}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <GroupPicker
        groups={groups}
        exclude={ids}
        onSubmit={(groupIds) => addToGroups([item.id], groupIds)}
      />
      {ids.length > 0 && (
        <div className="flex items-center gap-2">
          <Switch
            id="update-view-in-library"
            checked={inLibrary}
            onCheckedChange={(on) =>
              setTags((old) =>
                on
                  ? [
                      ...old,
                      {
                        label: VIEW_IN_LIBRARY_TAG,
                        value: VIEW_IN_LIBRARY_TAG,
                      },
                    ]
                  : old.filter((t) => t.value !== VIEW_IN_LIBRARY_TAG),
              )
            }
          />
          <Label htmlFor="update-view-in-library" className="text-sm">
            Also show in the main library (tag {VIEW_IN_LIBRARY_TAG})
          </Label>
        </div>
      )}
    </div>
  );
}

/** Library and group pages: the item and groups come from the library atoms. */
export default function ItemGroupsField({
  onChanged,
}: {
  onChanged: () => void;
}) {
  const id = useAtomValue(updateIdAtom);
  const item = useAtomValue(allContentAtom).find((c) => c.id === id);
  const groups = useAtomValue(allGroupsAtom);
  return (
    <ItemGroupsFieldView item={item} groups={groups} onChanged={onChanged} />
  );
}
