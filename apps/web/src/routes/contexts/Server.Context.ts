import { sanitizeStringForFileName } from "@tagapp/utils";
import { useMutation } from "@tanstack/react-query";
import constate from "constate";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { toast } from "sonner";
import { FilterQueryAtom, injectFilterDataIntoURLAtom } from "@/atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import {
  updateDataAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { orpc } from "@/lib/orpc";
import { filteredAtom, serverTagsAtom } from "../atom";
import {
  selectionEntriesAtom,
  selectionOnAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
} from "../atom.selection";

const useServer = () => {
  const setFiltered = useSetAtom(filteredAtom);
  const setInputDisabled = useSetAtom(updateInputDisabledAtom);
  const setServerTags = useSetAtom(serverTagsAtom);
  const injectFilterDataIntoURL = useSetAtom(injectFilterDataIntoURLAtom);

  const getServerTagsMutation = useMutation(
    orpc.main.getServerTags.mutationOptions({
      onSuccess: (res) => {
        setServerTags(Object.keys(res));
      },
      onError: () => {
        toast.error("Could't fetch server tags");
      },
    }),
  );
  const getFilteredDataMutation = useMutation(
    orpc.main.getFilteredData.mutationOptions({
      onSuccess: (res) => {
        getServerTagsMutation.mutate({});
        setFiltered(res);
      },
      onError: () => {
        console.warn("DB, online ?");
      },
    }),
  );

  const [selectedEntries, setSelectedEntries] = useAtom(selectionEntriesAtom);
  const setSelectionModeOn = useSetAtom(selectionOnAtom);
  const store = useStore();

  // Read at call time: the first load runs from a timeout that would otherwise see the pre-URL-init filters
  const filterData = useCallback(() => {
    injectFilterDataIntoURL();
    setSelectedEntries([]);
    setSelectionModeOn(false);
    getFilteredDataMutation.mutate(store.get(FilterQueryAtom));
  }, [store]);

  const syncContentsModified = useMutation(
    orpc.main.sync.mutationOptions({
      onSuccess: () => {
        getFilteredDataMutation.mutate(store.get(FilterQueryAtom));
      },
    }),
  );
  const serverSyncFunc = useCallback(() => syncContentsModified.mutate({}), []);

  const setUpdateTitle = useSetAtom(updateTitleAtom);
  const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
  const updateContentMutaion = useMutation(
    orpc.main.setContent.mutationOptions({
      onSuccess: (res) => {
        setFiltered((old) =>
          old.map((val) => {
            if (val.id !== res.id) return val;
            const content = { ...val };
            const oldTags = content.tags;
            const addedTags = res.tags.filter((tag) => !oldTags.includes(tag));
            setServerTags((old) => {
              const unSyncedTags = addedTags.filter(
                (tag) => !old.includes(tag),
              );
              if (!unSyncedTags.length) return old;
              return [...old, ...unSyncedTags];
            });
            return res;
          }),
        );
        setUpdateTitle(res.title);
        setUpdateModalOpen(false);
        setInputDisabled(false);
      },
      onError: () => {
        toast.error("Couldn't update, check console for error");
        setInputDisabled(false);
      },
    }),
  );

  const updateData = useAtomValue(updateDataAtom);
  const updateContentFunc = useCallback(() => {
    const sanitizedTitle = sanitizeStringForFileName(updateData.title);
    if (!sanitizedTitle) {
      toast("Title must not be blank");
      setUpdateTitle("");
      return;
    }
    const content: typeof updateData = { ...updateData, title: sanitizedTitle };
    setInputDisabled(true);
    updateContentMutaion.mutate(content);
  }, [updateData]);

  const setBulkUpdateModalOpen = useSetAtom(bulkUpdateModalOpenAtom);
  const bulkUpdateMutation = useMutation(
    orpc.main.bulkUpdateContentTags.mutationOptions({
      onSuccess: (res) => {
        setServerTags((old) => {
          const unSyncedTags = res.added.filter((tag) => !old.includes(tag));
          if (!unSyncedTags.length) return old;
          return [...old, ...unSyncedTags];
        });
        // New objects, not in-place edits: memo'd cards skip re-render on an identical reference
        setFiltered((oldFiltered) =>
          oldFiltered.map((content) => {
            if (!res.ids.includes(content.id)) return content;
            const tags = content.tags.filter((t) => !res.removed.includes(t));
            for (const tag of res.added)
              if (!tags.includes(tag)) tags.push(tag);
            return {
              ...content,
              tags,
              lastUpdated: Math.floor(Date.now() / 1000),
            };
          }),
        );
        setBulkUpdateModalOpen(false);
        setInputDisabled(false);
      },
      onError: () => {
        toast.error("Bulk update failed, check console for error");
        setInputDisabled(false);
      },
    }),
  );

  const selectionTags = useAtomValue(selectionTagsAtom);
  const selectionTagsInitial = useAtomValue(selectionTagsInitialAtom);

  const bulkUpdateContentFunc = useCallback(() => {
    const updatedTags = selectionTags.map((o) => o.value);
    const removedTags = selectionTagsInitial.filter(
      (x) => !updatedTags.includes(x),
    );
    const addedTags = updatedTags.filter(
      (x) => !selectionTagsInitial.includes(x),
    );
    setInputDisabled(true);
    bulkUpdateMutation.mutate({
      ids: selectedEntries,
      added: addedTags,
      removed: removedTags,
    });
  }, [selectionTags, selectedEntries, selectionTagsInitial]);

  const removeContentsMutation = useMutation(
    orpc.main.removeContents.mutationOptions({
      onSuccess: (res) => {
        setFiltered((old) => old.filter((doc) => !res.includes(doc.id)));
        setSelectedEntries((old) => old.filter((id) => !res.includes(id)));
      },
      onError: () => {
        toast.error("delete contents failed, check console for error");
      },
    }),
  );

  const removeContents = useCallback((keys: string[]) => {
    removeContentsMutation.mutate(keys);
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedEntries.includes(id);
    },
    [selectedEntries],
  );

  return {
    removeContents,
    setFiltered,
    updateContentFunc,
    bulkUpdateContentFunc,
    filterData,
    serverSyncFunc,
    isSelected,
  };
};

export const [ServerProvider, useServerActions] = constate(useServer);
