import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { tagsAtom } from "@/atom";
import TitleHeader from "@/components/craft/TitleHeader";
import UpdateModal from "@/components/craft/UpdateModal";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import SyncFilters from "./components/SyncFilters";
import SyncResults from "./components/SyncResults";
import { useSyncActions } from "./components/useSyncActions";
import { useSyncFilter } from "./components/useSyncFilter";

export default function SyncPage() {
  const tags = useAtomValue(tagsAtom);

  // Always rescans on open (the query client never refetches on mount); keeps the list while refreshing
  const scan = useQuery({
    ...orpc.main.getSyncData.queryOptions(),
    refetchOnMount: "always",
  });
  const groups = useQuery(orpc.groups.list.queryOptions({ input: {} })); // titles for the groups rows
  const contents = scan.data?.contents;
  const refresh = useCallback(() => void scan.refetch(), [scan.refetch]);

  const filter = useSyncFilter(contents);
  const { openEdit, saveEdit, remove, syncNow, syncing } = useSyncActions(
    contents,
    refresh,
  );

  return (
    <>
      {!!tags && <UpdateModal updateContentFunc={saveEdit} />}
      <TitleHeader
        Title="Sync preview"
        description={
          tags
            ? "What the next sync would add to the library. Edit or remove items before syncing; Refresh only rescans."
            : "What the next sync would add to the library. Editing, removing and syncing show up when the TagApp browser extension is connected."
        }
      >
        <Button
          variant="outline"
          size="sm"
          disabled={scan.isFetching}
          onClick={refresh}
          title="Scan the server's Sync folder again (does not sync)"
        >
          <RefreshCw className={scan.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
        {!!tags && (
          <Button
            size="sm"
            disabled={syncing}
            onClick={syncNow}
            title="Move everything listed here into the library"
          >
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        )}
      </TitleHeader>
      <SyncFilters filter={filter} contents={contents} />
      <SyncResults
        scan={scan}
        groups={groups.data}
        filter={filter}
        onRetry={refresh}
        onEdit={tags ? openEdit : undefined}
        onRemove={tags ? remove : undefined}
      />
    </>
  );
}
