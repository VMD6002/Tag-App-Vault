import type { GroupsDB } from "@tagapp/utils/types";
import { useMemo, useState } from "react";
import type { MultiSelectOption } from "@/atom";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NONE: string[] = [];

/**
 * Pick existing groups and/or name a new one. Presentational: `onSubmit` gets the picked group
 * ids and the new group's title ("" for none) and resolves to true when it worked (the form then
 * resets). Groups in `exclude` are not offered (the item is already in them).
 */
export default function GroupPicker({
  groups,
  exclude = NONE,
  submitLabel = "Add to group",
  onSubmit,
}: {
  groups: GroupsDB;
  exclude?: string[];
  submitLabel?: string;
  onSubmit: (groupIds: string[], newTitle: string) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<MultiSelectOption[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      Object.values(groups)
        .filter((g) => !exclude.includes(g.id))
        .map((g) => ({ label: g.title || g.id, value: g.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [groups, exclude],
  );
  const canSubmit = !busy && (picked.length > 0 || !!newTitle.trim());

  const submit = async () => {
    setBusy(true);
    try {
      const ok = await onSubmit(
        picked.map((o) => o.value),
        newTitle,
      );
      if (ok) {
        setPicked([]);
        setNewTitle("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Existing groups</Label>
        <MultiSelect
          options={options}
          placeholder="Choose groups"
          label="Groups to add to"
          value={picked}
          onChange={setPicked}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-picker-new">Or a new group</Label>
        <Input
          id="group-picker-new"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) void submit();
          }}
          placeholder="New group name"
        />
      </div>
      <Button
        className="justify-self-end"
        disabled={!canSubmit}
        onClick={() => void submit()}
      >
        {busy ? "Adding…" : submitLabel}
      </Button>
    </div>
  );
}
