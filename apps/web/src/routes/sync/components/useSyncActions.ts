import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  updateDataAtom,
  updateExtraDataAtom,
  updateIdAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { orpc } from "@/lib/orpc";
import type { SyncItem } from "./SyncCard";
import { asOptions } from "./useSyncFilter";

/** Edit (through the shared UpdateModal atoms), remove and sync; each refreshes the scan on success. */
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

  return {
    openEdit,
    saveEdit,
    remove,
    syncNow,
    syncing: syncMutation.isPending,
  };
}
