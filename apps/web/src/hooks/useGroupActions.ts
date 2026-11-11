import { newGroupId } from "@tagapp/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/** Awaits a group call; on failure toasts the error and resolves `undefined`. */
export async function run<T>(call: Promise<T>, success?: string) {
  try {
    const res = await call;
    if (success) toast.success(success);
    return res;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Group action failed");
    return undefined;
  }
}

/**
 * Group mutations for pages that hold the library in memory. After every successful call it
 * invalidates the `groups.*` queries and runs `onChanged`, which must reload the page's items,
 * groups and tag counts (the library passes `loadAllContent`). Each action resolves to `true` on success.
 */
export function useGroupActions(onChanged: () => void) {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const changed = () => {
      void queryClient.invalidateQueries({ queryKey: orpc.groups.key() });
      onChanged();
    };
    // `ok` is a success toast; the reload runs only when the call worked
    const act = async (call: Promise<unknown>, ok?: string) => {
      const done = (await run(call, ok)) !== undefined;
      if (done) changed();
      return done;
    };
    return {
      changed,
      /** Puts items into existing groups and/or one new group (`newTitle`). */
      async addToGroups(itemIds: string[], groupIds: string[], newTitle = "") {
        const targets = [...groupIds];
        const title = newTitle.trim();
        if (title) {
          const id = newGroupId();
          const created = await run(
            orpc.groups.create.call({ id, title, extraData: "", tags: [] }),
          );
          if (!created) return false;
          targets.push(id);
        }
        const results = await Promise.all(
          targets.map((id) => run(orpc.groups.addItems.call({ id, itemIds }))),
        );
        const ok = results.every((r) => r !== undefined);
        changed(); // a new group exists even when an add failed
        if (ok) toast.success("Added to the group");
        return ok;
      },
      removeItems: (id: string, itemIds: string[]) =>
        act(
          orpc.groups.removeItems.call({ id, itemIds }),
          "Removed from the group",
        ),
      disband: (id: string) =>
        act(orpc.groups.disband.call({ id }), "Group disbanded"),
    };
  }, [queryClient, onChanged]);
}
