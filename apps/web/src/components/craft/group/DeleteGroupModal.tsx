import type {
  ContentServerType,
  GroupsDB,
  GroupType,
} from "@tagapp/utils/types";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { run } from "@/hooks/useGroupActions";
import { getCoverUrl } from "@/lib/coverUrl";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

type Plan = { exclusive: ContentServerType[]; shared: ContentServerType[] };

/**
 * Delete-group dialog (`/group` and `/group/:id`). Asks the server what a delete would touch
 * (`groups.planDelete`); items that also belong to other groups are listed as selectable cards.
 * Without any it is a plain confirm. `onDone(ok)` runs after the call, so the page can reload.
 * Mount it with `group = null` while closed.
 */
export default function DeleteGroupModal({
  group,
  groups,
  step,
  onClose,
  onDone,
}: {
  group: GroupType | null;
  groups: GroupsDB;
  /** "Group 2 of 3" when several groups are deleted one after another. */
  step?: string;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  const id = group?.id;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the plan depends on the group id only
  useEffect(() => {
    setPlan(null);
    setSelected([]);
    if (!id) return;
    let live = true;
    void run(orpc.groups.planDelete.call({ id })).then((p) => {
      if (!live) return;
      if (p) setPlan(p);
      else onClose();
    });
    return () => {
      live = false;
    };
  }, [id]);

  const toggle = (itemId: string) =>
    setSelected((old) =>
      old.includes(itemId) ? old.filter((o) => o !== itemId) : [...old, itemId],
    );

  const confirmDelete = async (deleteIds: string[]) => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await run(
        orpc.groups.delete.call({ id, deleteIds }),
        "Group deleted",
      );
      onDone(res !== undefined);
    } finally {
      setBusy(false);
    }
  };

  const shared = plan?.shared ?? [];
  const exclusive = plan?.exclusive.length ?? 0;
  const name = group?.title || id;

  return (
    <ModalShell
      open={!!group}
      onClose={onClose}
      title={
        step
          ? `Delete group and its items? (${step})`
          : "Delete group and its items?"
      }
      description={
        plan
          ? `"${name}" and ${exclusive} ${exclusive === 1 ? "item" : "items"} only in this group are deleted from the server. This can't be undone.`
          : "Checking which items would be deleted…"
      }
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !plan}
            onClick={() => void confirmDelete([])}
          >
            {shared.length
              ? "Delete only items exclusive to this group"
              : "Delete group and items"}
          </Button>
          {shared.length > 0 && (
            <Button
              variant="destructive"
              disabled={busy || !selected.length}
              onClick={() => void confirmDelete(selected)}
            >
              Also delete the selected shared items
            </Button>
          )}
        </>
      }
    >
      {shared.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            {shared.length} {shared.length === 1 ? "item is" : "items are"} also
            in other groups. They only lose this group unless you select them.
          </p>
          <ul className="grid max-h-[40vh] grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 overflow-y-auto">
            {shared.map((item) => {
              const on = selected.includes(item.id);
              const cover = getCoverUrl(item);
              const others = (item.groups ?? [])
                .filter((g) => g !== id)
                .map((g) => groups[g]?.title || g)
                .join(", ");
              return (
                <li key={item.id}>
                  <label
                    htmlFor={`delete-group-${item.id}`}
                    className={cn(
                      "flex h-full cursor-pointer flex-col border bg-card/40",
                      on && "border-foreground ring-1 ring-foreground",
                    )}
                  >
                    <div className="relative flex h-20 items-center justify-center overflow-hidden border-b bg-muted/40">
                      {cover ? (
                        <img
                          src={`/${cover}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageOff className="size-5 text-muted-foreground/50" />
                      )}
                      <Checkbox
                        id={`delete-group-${item.id}`}
                        checked={on}
                        onCheckedChange={() => toggle(item.id)}
                        aria-label={`Also delete ${item.title}`}
                        className="absolute top-1.5 left-1.5 bg-background/90"
                      />
                    </div>
                    <div className="grid gap-0.5 p-2">
                      <span className="line-clamp-2 text-xs font-medium [overflow-wrap:anywhere]">
                        {item.title}
                      </span>
                      <span className="line-clamp-2 text-[11px] text-muted-foreground">
                        Also in: {others}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ModalShell>
  );
}
