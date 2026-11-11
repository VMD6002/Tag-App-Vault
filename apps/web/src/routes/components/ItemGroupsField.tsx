import { VIEW_HIDE_IN_LIBRARY_TAG, VIEW_IN_LIBRARY_TAG } from "@tagapp/utils";
import type { GroupsDB } from "@tagapp/utils/types";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { Link } from "wouter";
import { clearFilterForNavigationAtom } from "@/atom";
import GroupPicker from "@/components/craft/GroupPicker";
import {
  updateGroupsAtom,
  updateModalOpenAtom,
  updateTagsAtom,
} from "@/components/craft/UpdateModal/atom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { allGroupsAtom } from "../atom";

/**
 * Item edit: the item's pending groups (`updateGroupsAtom`: link to the group, remove), a picker to
 * add more, and the `view:in-library` (once grouped) and `view:hide-in-library` (always) toggles.
 * Everything here only edits atoms; Save sends groups and tags together, Cancel drops them.
 */
export function ItemGroupsFieldView({ groups }: { groups: GroupsDB }) {
  const [tags, setTags] = useAtom(updateTagsAtom);
  const [ids, setIds] = useAtom(updateGroupsAtom);
  const setModalOpen = useSetAtom(updateModalOpenAtom);
  const clearFilter = useSetAtom(clearFilterForNavigationAtom);

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
                  title="Remove this item from the group (on Save)"
                  aria-label={`Remove from ${groups[gid]?.title || gid}`}
                  onClick={() => setIds((old) => old.filter((g) => g !== gid))}
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
        onSubmit={async (groupIds) => {
          setIds((old) => [...new Set([...old, ...groupIds])]);
          return true;
        }}
      />
      {(
        [
          [
            VIEW_IN_LIBRARY_TAG,
            "update-view-in-library",
            `Also show in the main library (tag ${VIEW_IN_LIBRARY_TAG})`,
            ids.length > 0,
          ],
          [
            VIEW_HIDE_IN_LIBRARY_TAG,
            "update-view-hide-in-library",
            `Hide from the main library (tag ${VIEW_HIDE_IN_LIBRARY_TAG})`,
            true,
          ],
        ] as const
      ).map(
        ([tag, id, text, shown]) =>
          shown && (
            <div key={tag} className="flex items-center gap-2">
              <Switch
                id={id}
                checked={tags.some((t) => t.value === tag)}
                onCheckedChange={(on) =>
                  setTags((old) =>
                    on
                      ? [...old, { label: tag, value: tag }]
                      : old.filter((t) => t.value !== tag),
                  )
                }
              />
              <Label htmlFor={id} className="text-sm">
                {text}
              </Label>
            </div>
          ),
      )}
    </div>
  );
}

/** Library and group pages: the groups come from the library atoms. */
export default function ItemGroupsField() {
  return <ItemGroupsFieldView groups={useAtomValue(allGroupsAtom)} />;
}
