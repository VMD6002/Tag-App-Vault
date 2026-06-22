import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { serverTagsAtom, filteredAtom } from "../atom";
import {
  updateInputDisabledAtom,
  updateDataAtom,
  updateModalOpenAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import {
  selectionEntriesAtom,
  selectionOnAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
} from "../atom.selection";
import { FilterQueryAtom, injectFilterDataIntoURLAtom } from "@/atom";
import { sanitizeStringForFileName } from "@tagapp/utils";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import constate from "constate";

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
        alert("Could't fetch server tags");
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
  const FilterQuery = useAtomValue(FilterQueryAtom);

  const filterData = useCallback(() => {
    injectFilterDataIntoURL();
    setSelectedEntries([]);
    setSelectionModeOn(false);
    getFilteredDataMutation.mutate(FilterQuery);
  }, [FilterQuery]);

  const syncContentsModified = useMutation(
    orpc.main.sync.mutationOptions({
      onSuccess: () => {
        getFilteredDataMutation.mutate(FilterQuery);
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
        alert("Couldn't update, check console for error");
        setInputDisabled(false);
      },
    }),
  );

  const updateData = useAtomValue(updateDataAtom);
  const updateContentFunc = useCallback(() => {
    const sanitizedTitle = sanitizeStringForFileName(updateData.title);
    if (!sanitizedTitle) {
      alert("Title must not be blank");
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
        setFiltered((oldFiltered) =>
          oldFiltered.map((content) => {
            if (!res.ids.includes(content.id)) return content;
            for (const tag of res.removed) {
              content.tags = content.tags.filter((val) => val !== tag);
              content.lastUpdated = Math.floor(Date.now() / 1000);
            }
            for (const tag of res.added) {
              if (content.tags.includes(tag)) continue;
              content.tags.push(tag);
            }
            return content;
          }),
        );
        setBulkUpdateModalOpen(false);
        setInputDisabled(false);
      },
      onError: () => {
        alert("Bulk update failed, check console for error");
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
      },
      onError: () => {
        alert("delete contents failed, check console for error");
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
