import type { GroupsDB } from "@tagapp/utils/types";
import { useMemo, useState } from "react";
import type { MultiSelectOption } from "@/atom";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const NONE: string[] = [];

/**
 * Pick existing groups (groups are created on `/group` only). Presentational: `onSubmit` gets the
 * picked group ids and resolves to true when it worked (the form then resets). Groups in `exclude`
 * are not offered (the item is already in them).
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
  onSubmit: (groupIds: string[]) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<MultiSelectOption[]>([]);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      Object.values(groups)
        .filter((g) => !exclude.includes(g.id))
        .map((g) => ({ label: g.title || g.id, value: g.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [groups, exclude],
  );
  const canSubmit = !busy && picked.length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      if (await onSubmit(picked.map((o) => o.value))) setPicked([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Groups</Label>
        <MultiSelect
          options={options}
          placeholder="Choose groups"
          label="Groups to add to"
          value={picked}
          onChange={setPicked}
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
