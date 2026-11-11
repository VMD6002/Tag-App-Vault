import { VIEW_HIDE_IN_LIBRARY_TAG, VIEW_IN_LIBRARY_TAG } from "@tagapp/utils";
import type { GroupsDB } from "@tagapp/utils/types";
import { useAtom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { groupedInLibraryAtom } from "@/atom";
import MultiSelect from "@/components/craft/MultiSelect";
import {
  updateGroupsAtom,
  updateTagsAtom,
} from "@/components/craft/UpdateModal/atom";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { allGroupsAtom } from "../atom";

/**
 * Item edit: the item's groups (existing ones only; groups are created on `/group`) as one
 * `MultiSelect` on `updateGroupsAtom`, and the `view:in-library` (once grouped, and only while Settings hides grouped items) and
 * `view:hide-in-library` (always) toggles. Same as the extension's `GroupsField`. Everything here
 * only edits atoms; Save sends groups and tags together, Cancel drops them.
 */
export function ItemGroupsFieldView({ groups }: { groups: GroupsDB }) {
  const [tags, setTags] = useAtom(updateTagsAtom);
  const [ids, setIds] = useAtom(updateGroupsAtom);
  const groupedShown = useAtomValue(groupedInLibraryAtom) === "show";

  const options = useMemo(
    () =>
      Object.values(groups)
        .map((g) => ({ label: g.title || g.id, value: g.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [groups],
  );

  return (
    <div className="grid gap-2">
      <Label>Groups</Label>
      <MultiSelect
        options={options}
        placeholder="Add to a group"
        label="Groups"
        value={ids.map((id) => ({ label: groups[id]?.title || id, value: id }))}
        onChange={(opts) => setIds(opts.map((o) => o.value))}
      />
      {(
        [
          [
            VIEW_IN_LIBRARY_TAG,
            "update-view-in-library",
            "Also show in the main library",
            ids.length > 0 && !groupedShown, // pointless when Settings shows grouped items
          ],
          [
            VIEW_HIDE_IN_LIBRARY_TAG,
            "update-view-hide-in-library",
            "Hide from the main library",
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
