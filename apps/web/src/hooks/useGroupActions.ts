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
      /** Puts items into existing groups. */
      async addToGroups(itemIds: string[], groupIds: string[]) {
        const results = await Promise.all(
          groupIds.map((id) => run(orpc.groups.addItems.call({ id, itemIds }))),
        );
        const ok = results.every((r) => r !== undefined);
        changed(); // some adds may have worked even when one failed
        if (ok) toast.success("Added to the group");
        return ok;
      },
      removeItems: (id: string, itemIds: string[]) =>
        act(
          orpc.groups.removeItems.call({ id, itemIds }),
          "Removed from the group",
        ),
      /** Fix Data: one group, or every group without `id`. Toasts what it changed. */
      async fix(id?: string) {
        const res = await run(orpc.groups.fix.call({ id }));
        if (!res) return false;
        const { created, cleared } = res;
        toast.success(
          created.length + cleared.length === 0
            ? "Nothing to fix"
            : `Fixed: ${created.length} missing ${created.length === 1 ? "record" : "records"} created, ${cleared.length} empty ${cleared.length === 1 ? "cover" : "covers"} cleared`,
        );
        changed();
        return true;
      },
      disband: (id: string) =>
        act(orpc.groups.disband.call({ id }), "Group disbanded"),
    };
  }, [queryClient, onChanged]);
}
