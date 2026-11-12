import type { GroupsDB } from "@tagapp/utils/types";
import { useAtomValue, useSetAtom } from "jotai";
import { Inbox, SearchX } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import { ResultsBar } from "@/components/craft/library/FilterPanel";
import {
  SelectionActions,
  SelectionToggle,
} from "@/components/craft/library/SelectionBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  selectAllAtom,
  selectionEntriesAtom,
  selectionOnAtom,
  toggleSelectionModeAtom,
  unSelectAllAtom,
} from "@/routes/atom.selection";
import SyncCard, { type SyncItem, syncKey } from "./SyncCard";
import type { SyncBulk } from "./useSyncActions";
import type { SyncFilter } from "./useSyncFilter";

type Scan = {
  data?: {
    contents: Record<string, SyncItem>;
    unsyncable: string[];
    orphanJsons: string[];
  };
  isError: boolean;
  isPending: boolean;
  error: Error | null;
};

/** Results bar (with the selection controls), the loading/error/empty states and the card grid. Edit, remove and selection are omitted in read-only mode. */
export default function SyncResults({
  scan,
  groups,
  filter: { filtered, fields, setOrder, activeCount, clear },
  onRetry,
  onEdit,
  onRemove,
  bulk,
}: {
  scan: Scan;
  groups?: GroupsDB;
  filter: SyncFilter;
  onRetry: () => void;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  bulk?: SyncBulk;
}) {
  const selectionOn = useAtomValue(selectionOnAtom);
  const selected = useAtomValue(selectionEntriesAtom);
  const toggleSelection = useSetAtom(toggleSelectionModeAtom);
  const selectAll = useSetAtom(selectAllAtom);
  const unSelectAll = useSetAtom(unSelectAllAtom);
  const unsyncable = scan.data?.unsyncable.length ?? 0;
  const orphans = scan.data?.orphanJsons.length ?? 0;

  return (
    <>
      <ResultsBar
        left={
          <>
            {bulk && (
              <SelectionToggle on={selectionOn} onToggle={toggleSelection} />
            )}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {bulk && selectionOn ? (
                <>
                  <span className="font-semibold text-foreground tabular-nums">
                    {selected.length}
                  </span>{" "}
                  of <span className="tabular-nums">{filtered.length}</span>{" "}
                  selected
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground tabular-nums">
                    {filtered.length}
                  </span>{" "}
                  {filtered.length === 1 ? "item" : "items"}
                  {(unsyncable > 0 || orphans > 0) &&
                    ` · ${unsyncable} unreadable ${unsyncable === 1 ? "file moves" : "files move"} to UnSyncable on sync, ${orphans} JSON without an item`}
                </>
              )}
            </p>
            {bulk && selectionOn && (
              <SelectionActions
                total={filtered.length}
                selected={selected.length}
                onSelectAll={(on) =>
                  on
                    ? selectAll(filtered.map((c) => syncKey(c as SyncItem)))
                    : unSelectAll()
                }
                onEditTags={bulk.editTags}
                onAddToGroup={bulk.addToGroup}
                onRemove={bulk.removeSelected}
                removeTitle="Move the selected items to UnSyncable (nothing is deleted)"
              />
            )}
          </>
        }
        right={
          <>
            <Label htmlFor="sync-order-latest-switch" className="text-sm">
              Newest first
            </Label>
            <Switch
              id="sync-order-latest-switch"
              checked={fields.orderByLatest}
              onCheckedChange={setOrder}
            />
          </>
        }
      />
      {scan.isError ? (
        <ErrorState
          title="Couldn't scan the Sync folder"
          message={scan.error?.message}
          onRetry={onRetry}
        />
      ) : scan.isPending ? (
        <LoadingState label="Scanning the Sync folder…" />
      ) : filtered.length === 0 ? (
        activeCount > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No items match these filters"
            description="Try removing a tag or type, or shortening the search."
          >
            <Button variant="outline" size="sm" onClick={clear}>
              Clear filters and show everything
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={Inbox}
            title="Nothing is waiting to sync"
            description="Finished downloads and files you put in the server's Sync folder show up here."
          />
        )
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {filtered.map((data) => (
            <SyncCard
              key={data.id}
              Content={scan.data?.contents[data.id] ?? (data as SyncItem)}
              groups={groups}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </>
  );
}
