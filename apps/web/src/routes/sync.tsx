import { contentTypes, filterData } from "@tagapp/utils";
import type { ContentServerType } from "@tagapp/utils/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Inbox, RefreshCw, SearchX } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type MultiSelectOption, realtimeFilterAtom, tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import ContentCard, { typeInfo } from "@/components/craft/library/ContentCard";
import {
  FilterField,
  FilterPanel,
  ResultsBar,
} from "@/components/craft/library/FilterPanel";
import MultiSelect from "@/components/craft/MultiSelect";
import TitleHeader from "@/components/craft/TitleHeader";
import UpdateModal from "@/components/craft/UpdateModal";
import {
  updateDataAtom,
  updateExtraDataAtom,
  updateIdAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/lib/orpc";

// Own filter state: the library's atoms and URL query stay untouched
type Fields = {
  search: string;
  all: MultiSelectOption[];
  any: MultiSelectOption[];
  none: MultiSelectOption[];
  types: MultiSelectOption[];
  orderByLatest: boolean;
};
const NO_FILTER: Fields = {
  search: "",
  all: [],
  any: [],
  none: [],
  types: [],
  orderByLatest: true,
};
const values = (o: MultiSelectOption[]) => o.map((x) => x.value);
const toQuery = (f: Fields) => ({
  ...f,
  all: values(f.all),
  any: values(f.any),
  none: values(f.none),
  types: values(f.types),
});
const asOptions = (tags: string[]) => tags.map((t) => ({ label: t, value: t }));

const SyncCard = memo(
  ({
    Content,
    onEdit,
    onRemove,
  }: {
    Content: ContentServerType;
    onEdit?: (id: string) => void;
    onRemove?: (id: string) => void;
  }) => (
    <ContentCard
      content={Content}
      cover={null}
      onEdit={onEdit && (() => onEdit(Content.id))}
      onRemove={onRemove && (() => onRemove(Content.id))}
    />
  ),
);
SyncCard.displayName = "SyncCard";

export default function SyncPage() {
  const tags = useAtomValue(tagsAtom);
  const [realtime, setRealtime] = useAtom(realtimeFilterAtom);
  const [fields, setFields] = useState(NO_FILTER);
  const query = useMemo(() => toQuery(fields), [fields]);
  const [applied, setApplied] = useState(query);
  const patch = (p: Partial<Fields>) => setFields((f) => ({ ...f, ...p }));

  // Realtime: apply shortly after the search text or any filter changes
  useEffect(() => {
    if (!realtime) return;
    const timeout = setTimeout(() => setApplied(query), 200);
    return () => clearTimeout(timeout);
  }, [realtime, query]);

  // Always rescans on open (the query client never refetches on mount); keeps the list while refreshing
  const scan = useQuery({
    ...orpc.main.getSyncData.queryOptions(),
    refetchOnMount: "always",
  });
  const contents = scan.data?.contents;
  const refresh = useCallback(() => void scan.refetch(), [scan.refetch]);

  const filtered = useMemo(
    () => filterData(applied, contents ?? {}),
    [applied, contents],
  );
  const allTags = useMemo(
    () =>
      [...new Set(Object.values(contents ?? {}).flatMap((c) => c.tags))].sort(),
    [contents],
  );
  const tagOptions = useMemo(() => asOptions(allTags), [allTags]);
  const anyNoneOptions = useMemo(
    () => [
      ...tagOptions,
      { label: "*", value: "*" },
      ...asOptions([...new Set(allTags.map((t) => `${t.split(":")[0]}:*`))]),
    ],
    [allTags, tagOptions],
  );
  const typeOptions = useMemo(
    () => contentTypes.map((o) => ({ label: typeInfo[o].label, value: o })),
    [],
  );
  const activeCount =
    fields.any.length +
    fields.none.length +
    fields.all.length +
    fields.types.length +
    (fields.search.trim() ? 1 : 0);

  const setInputDisabled = useSetAtom(updateInputDisabledAtom);
  const setModalOpen = useSetAtom(updateModalOpenAtom);
  const setUpdateId = useSetAtom(updateIdAtom);
  const setTitle = useSetAtom(updateTitleAtom);
  const setUpdateTags = useSetAtom(updateTagsAtom);
  const setExtraData = useSetAtom(updateExtraDataAtom);
  const updateData = useAtomValue(updateDataAtom);

  const editMutation = useMutation(
    orpc.main.editSyncItem.mutationOptions({
      onSuccess: () => {
        setModalOpen(false);
        setInputDisabled(false);
        refresh();
      },
      onError: () => {
        toast.error("Couldn't save, check console for error");
        setInputDisabled(false);
      },
    }),
  );
  const removeMutation = useMutation(
    orpc.main.removeSyncItem.mutationOptions({
      onSuccess: refresh,
      onError: () => toast.error("Couldn't remove, check console for error"),
    }),
  );
  const syncMutation = useMutation(
    orpc.main.sync.mutationOptions({
      onSuccess: refresh,
      onError: () => toast.error("Sync failed, check console for error"),
    }),
  );

  const openEdit = useCallback(
    (id: string) => {
      const item = contents?.[id];
      if (!item) return;
      setTitle(item.title);
      setUpdateTags(asOptions(item.tags));
      setExtraData(item.extraData);
      setUpdateId(id);
      setModalOpen(true);
    },
    [
      contents,
      setTitle,
      setUpdateTags,
      setExtraData,
      setUpdateId,
      setModalOpen,
    ],
  );
  const saveEdit = () => {
    const item = contents?.[updateData.id];
    if (!item) return;
    if (!updateData.title.trim()) return void toast("Title must not be blank");
    setInputDisabled(true);
    editMutation.mutate({
      name: item.name,
      type: item.type,
      title: updateData.title,
      tags: updateData.tags,
      extraData: updateData.extraData,
    });
  };
  const remove = useCallback(
    (id: string) => {
      const item = contents?.[id];
      if (!item) return;
      void confirm({
        title: "Remove this item from the sync queue?",
        description: `"${item.title}" and its files move to the server's UnSyncable folder, so it won't be synced. Nothing is deleted.`,
        confirmText: "Move to UnSyncable",
      }).then((ok) => {
        if (ok) removeMutation.mutate({ name: item.name, type: item.type });
      });
    },
    [contents, removeMutation.mutate],
  );
  const syncNow = () =>
    void confirm({
      title: "Sync these items into the library?",
      description:
        "Syncs everything listed here, with the edits you made. Files the server can't read are moved to its UnSyncable folder.",
      confirmText: "Sync now",
    }).then((ok) => {
      if (ok) syncMutation.mutate({});
    });

  const clear = () => {
    setFields(NO_FILTER);
    setApplied(toQuery(NO_FILTER));
  };

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
            disabled={syncMutation.isPending}
            onClick={syncNow}
            title="Move everything listed here into the library"
          >
            {syncMutation.isPending ? "Syncing…" : "Sync"}
          </Button>
        )}
      </TitleHeader>
      <FilterPanel
        search={fields.search}
        onSearchChange={(search) => patch({ search })}
        onApply={() => setApplied(query)}
        realtime={realtime}
        onRealtimeChange={setRealtime}
        onClear={clear}
        activeCount={activeCount}
      >
        <FilterField label="Type" hint="any of these">
          <MultiSelect
            value={fields.types}
            onChange={(types) => patch({ types })}
            options={typeOptions}
            placeholder="All types"
            label="Content types"
          />
        </FilterField>
        <FilterField label="Any of" hint="at least one">
          <MultiSelect
            value={fields.any}
            onChange={(any) => patch({ any })}
            options={anyNoneOptions}
            placeholder="Choose tags"
            label="Any of these tags"
          />
        </FilterField>
        <FilterField label="None of" hint="exclude these">
          <MultiSelect
            value={fields.none}
            onChange={(none) => patch({ none })}
            options={anyNoneOptions}
            placeholder="Choose tags"
            label="None of these tags"
          />
        </FilterField>
        <FilterField label="All of" hint="must have every one">
          <MultiSelect
            value={fields.all}
            onChange={(all) => patch({ all })}
            options={tagOptions}
            placeholder="Choose tags"
            label="All of these tags"
          />
        </FilterField>
      </FilterPanel>
      <ResultsBar
        left={
          <p aria-live="polite" className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "item" : "items"}
            {scan.data &&
              (scan.data.unsyncable.length > 0 ||
                scan.data.orphanJsons.length > 0) &&
              ` · ${scan.data.unsyncable.length} unreadable ${scan.data.unsyncable.length === 1 ? "file moves" : "files move"} to UnSyncable on sync, ${scan.data.orphanJsons.length} JSON without an item`}
          </p>
        }
        right={
          <>
            <Label htmlFor="sync-order-latest-switch" className="text-sm">
              Newest first
            </Label>
            <Switch
              id="sync-order-latest-switch"
              checked={fields.orderByLatest}
              onCheckedChange={(orderByLatest) => {
                patch({ orderByLatest });
                setApplied((q) => ({ ...q, orderByLatest }));
              }}
            />
          </>
        }
      />
      {scan.isError ? (
        <ErrorState
          title="Couldn't scan the Sync folder"
          message={scan.error?.message}
          onRetry={refresh}
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
              Content={data}
              onEdit={tags ? openEdit : undefined}
              onRemove={tags ? remove : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
