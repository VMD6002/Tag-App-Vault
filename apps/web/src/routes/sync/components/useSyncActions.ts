import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { addToGroupAtom } from "@/components/craft/AddToGroupModal.atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  updateDataAtom,
  updateExtraDataAtom,
  updateGroupsAtom,
  updateIdAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { run } from "@/hooks/useGroupActions";
import { orpc } from "@/lib/orpc";
import {
  prefillSelectionTagsAtom,
  selectionEntriesAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
} from "@/routes/atom.selection";
import { type SyncItem, syncKey } from "./SyncCard";
import { asOptions } from "./useSyncFilter";

/** Selection actions of the results bar (`undefined` in read-only mode). */
export type SyncBulk = {
  editTags: () => void;
  addToGroup: () => void;
  removeSelected: () => void;
};

/**
 * Edit (through the shared UpdateModal atoms), remove and sync, plus the same on the selection
 * (the library's selection atoms, keyed by `syncKey`): bulk tags, add to group, bulk remove.
 * Each refreshes the scan on success.
 */
export function useSyncActions(
  contents: Record<string, SyncItem> | undefined,
  refresh: () => void,
) {
  const setInputDisabled = useSetAtom(updateInputDisabledAtom);
  const setModalOpen = useSetAtom(updateModalOpenAtom);
  const setUpdateId = useSetAtom(updateIdAtom);
  const setTitle = useSetAtom(updateTitleAtom);
  const setUpdateTags = useSetAtom(updateTagsAtom);
  const setExtraData = useSetAtom(updateExtraDataAtom);
  const setUpdateGroups = useSetAtom(updateGroupsAtom);
  const updateData = useAtomValue(updateDataAtom);
  const selectedKeys = useAtomValue(selectionEntriesAtom);
  const selectionTags = useAtomValue(selectionTagsAtom);
  const selectionTagsInitial = useAtomValue(selectionTagsInitialAtom);
  const prefillSelectionTags = useSetAtom(prefillSelectionTagsAtom);
  const setBulkOpen = useSetAtom(bulkUpdateModalOpenAtom);
  const setAddToGroup = useSetAtom(addToGroupAtom);

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
  const bulkEditMutation = useMutation(
    orpc.main.bulkEditSyncItems.mutationOptions({ onSuccess: refresh }),
  );
  const bulkRemoveMutation = useMutation(
    orpc.main.bulkRemoveSyncItems.mutationOptions({
      onSuccess: (ids) => {
        toast.success(
          `Moved ${ids.length} ${ids.length === 1 ? "item" : "items"} to UnSyncable`,
        );
        refresh();
      },
      onError: (e) => toast.error(e.message),
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
      setUpdateGroups(item.groups ?? []);
      setUpdateId(id);
      setModalOpen(true);
    },
    [
      contents,
      setTitle,
      setUpdateTags,
      setExtraData,
      setUpdateGroups,
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
      groups: updateData.groups,
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

  // The pending items behind a selection (it also holds keys of items a rescan removed)
  const byKey = useMemo(
    () => new Map(Object.values(contents ?? {}).map((c) => [syncKey(c), c])),
    [contents],
  );
  const refsOf = (keys: string[]) =>
    keys.flatMap((k) => {
      const c = byKey.get(k);
      return c ? [{ name: c.name, type: c.type }] : [];
    });

  const editTags = () => {
    prefillSelectionTags(selectedKeys.map((k) => byKey.get(k)?.tags ?? []));
    setBulkOpen(true);
  };
  const saveBulkTags = () => {
    const next = selectionTags.map((o) => o.value);
    const added = next.filter((t) => !selectionTagsInitial.includes(t));
    const removed = selectionTagsInitial.filter((t) => !next.includes(t));
    if (!added.length && !removed.length) return setBulkOpen(false);
    bulkEditMutation.mutate(
      { items: refsOf(selectedKeys), added, removed },
      {
        onSuccess: () => setBulkOpen(false),
        onError: (e) => toast.error(e.message),
      },
    );
  };
  /** Pending items take their groups in the sidecar; the next sync applies them. */
  const addToGroups = async (keys: string[], groupIds: string[]) => {
    const res = await run(
      bulkEditMutation.mutateAsync({
        items: refsOf(keys),
        addGroups: groupIds,
      }),
      `Added to ${groupIds.length === 1 ? "the group" : "the groups"}`,
    );
    return res !== undefined;
  };
  const removeSelected = () => {
    const items = refsOf(selectedKeys);
    void confirm({
      title: `Remove ${items.length} ${items.length === 1 ? "item" : "items"} from the sync queue?`,
      description:
        "The selected items and their files move to the server's UnSyncable folder, so they won't be synced. Nothing is deleted.",
      confirmText: "Move to UnSyncable",
    }).then((ok) => {
      if (ok) bulkRemoveMutation.mutate({ items });
    });
  };

  const syncNow = () =>
    void confirm({
      title: "Sync these items into the library?",
      description:
        "Syncs everything listed here, with the edits you made. Files the server can't read are moved to its UnSyncable folder.",
      confirmText: "Sync now",
    }).then((ok) => {
      if (ok) syncMutation.mutate({});
    });

  return {
    openEdit,
    saveEdit,
    remove,
    syncNow,
    syncing: syncMutation.isPending,
    bulk: {
      editTags,
      addToGroup: () => setAddToGroup(selectedKeys),
      removeSelected,
    } satisfies SyncBulk,
    saveBulkTags,
    savingBulkTags: bulkEditMutation.isPending,
    addToGroups,
  };
}
