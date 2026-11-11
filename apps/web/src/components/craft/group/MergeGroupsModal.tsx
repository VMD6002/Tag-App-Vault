import type { GroupType } from "@tagapp/utils/types";
import { useEffect, useState } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { run } from "@/hooks/useGroupActions";
import { orpc } from "@/lib/orpc";

/**
 * Merge two or more groups (`groups.merge`): pick the group to keep. Every item is moved to it,
 * the tags are united, and title, description and cover stay the kept group's. Mount with
 * `groups = null` while closed. `onDone(ok)` runs after the call so the page can reload.
 */
export default function MergeGroupsModal({
  groups,
  counts,
  onClose,
  onDone,
}: {
  groups: GroupType[] | null;
  /** Item count per group id. */
  counts: Record<string, number>;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  const [keepId, setKeepId] = useState("");
  const [busy, setBusy] = useState(false);
  const key = groups?.map((g) => g.id).join("\n") ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the selection changes
  useEffect(() => {
    setKeepId(groups?.[0]?.id ?? "");
  }, [key]);

  const merge = async () => {
    if (!groups) return;
    setBusy(true);
    try {
      const res = await run(
        orpc.groups.merge.call({ ids: groups.map((g) => g.id), keepId }),
        "Groups merged",
      );
      onDone(res !== undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={!!groups}
      onClose={onClose}
      title="Merge groups"
      description="Pick the group to keep. Every item moves into it and the other groups are deleted; the items are kept. Tags are united; the title, description and cover stay the kept group's."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !keepId} onClick={() => void merge()}>
            {busy ? "Merging…" : `Merge ${groups?.length ?? 0} groups`}
          </Button>
        </>
      }
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Keep</legend>
        {groups?.map((g) => (
          <label
            key={g.id}
            className="flex cursor-pointer items-start gap-2 border p-2 text-sm has-[:checked]:border-foreground"
          >
            <input
              type="radio"
              name="merge-keep"
              value={g.id}
              checked={keepId === g.id}
              onChange={() => setKeepId(g.id)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block font-medium [overflow-wrap:anywhere]">
                {g.title || g.id}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {g.id} · {counts[g.id] ?? 0}{" "}
                {(counts[g.id] ?? 0) === 1 ? "item" : "items"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </ModalShell>
  );
}
