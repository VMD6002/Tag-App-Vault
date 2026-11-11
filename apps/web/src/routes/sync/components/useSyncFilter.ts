import { filterData } from "@tagapp/utils";
import { useFilterState } from "@/hooks/useFilterState";
import type { SyncItem } from "./SyncCard";

export { asOptions } from "@/hooks/useFilterState";

const run = (
  query: Parameters<typeof filterData>[0],
  contents: Record<string, SyncItem> | undefined,
) => filterData(query, contents ?? {});

/** Client-side filter of the pending items. */
export const useSyncFilter = (contents: Record<string, SyncItem> | undefined) =>
  useFilterState(contents, run);

export type SyncFilter = ReturnType<typeof useSyncFilter>;
