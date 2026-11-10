import {
  filterData as filterContent,
  sanitizeStringForFileName,
} from "@tagapp/utils";
import type { ContentServerType } from "@tagapp/utils/types";
import { useMutation } from "@tanstack/react-query";
import constate from "constate";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  FilterQueryAtom,
  injectFilterDataIntoURLAtom,
  realtimeFilterAtom,
} from "@/atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import {
  updateDataAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { orpc } from "@/lib/orpc";
import { allContentAtom, filteredAtom, serverTagsAtom } from "../atom";
import {
  selectionEntriesAtom,
  selectionOnAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
} from "../atom.selection";

const useServer = () => {
  const setFiltered = useSetAtom(filteredAtom);
  const setAllContent = useSetAtom(allContentAtom);
  const store = useStore();
  const realtime = useAtomValue(realtimeFilterAtom);
  const filterQuery = useAtomValue(FilterQueryAtom);
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
  // Filters the library held in memory (no server call)
  const runFilter = useCallback(() => {
    const all = store.get(allContentAtom);
    setFiltered(
      filterContent(
        store.get(FilterQueryAtom),
        Object.fromEntries(all.map((c) => [c.id, c])),
      ),
    );
  }, [store, setFiltered]);

  // Edit, bulk edit and delete patch both lists so an edited item doesn't vanish from the view
  const patchContent = useCallback(
    (fn: (old: ContentServerType[]) => ContentServerType[]) => {
      setAllContent(fn);
      setFiltered(fn);
    },
    [setAllContent, setFiltered],
  );

  const getAllContentMutation = useMutation(
    orpc.main.getAllContent.mutationOptions({
      onSuccess: (res) => {
        getServerTagsMutation.mutate({});
        setAllContent(Object.values(res));
        runFilter();
      },
      onError: () => {
        console.warn("DB, online ?");
      },
    }),
  );

  const [selectedEntries, setSelectedEntries] = useAtom(selectionEntriesAtom);
  const setSelectionModeOn = useSetAtom(selectionOnAtom);

  // Reads the atoms at call time: the first load runs from a timeout that would otherwise see the pre-URL-init filters
  const filterData = useCallback(
    (replaceURL?: boolean) => {
      injectFilterDataIntoURL(replaceURL);
      setSelectedEntries([]);
      setSelectionModeOn(false);
      runFilter();
    },
    [
      runFilter,
      setSelectedEntries,
      injectFilterDataIntoURL,
      setSelectionModeOn,
    ],
  );

  // Realtime: re-filter shortly after the search text or any filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: filterQuery is the trigger, filterData reads the same atoms from the store
  useEffect(() => {
    if (!realtime) return;
    const timeout = setTimeout(() => filterData(true), 200);
    return () => clearTimeout(timeout);
  }, [realtime, filterQuery, filterData]);

  const loadAllContent = useCallback(
    () => getAllContentMutation.mutate({}),
    [getAllContentMutation.mutate],
  );

  const syncContentsModified = useMutation(
    orpc.main.sync.mutationOptions({
      onSuccess: loadAllContent,
    }),
  );
  const serverSyncFunc = useCallback(
    () => syncContentsModified.mutate({}),
    [syncContentsModified.mutate],
  );

  const setUpdateTitle = useSetAtom(updateTitleAtom);
  const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
  const updateContentMutaion = useMutation(
    orpc.main.setContent.mutationOptions({
      onSuccess: (res) => {
        patchContent((old) =>
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
  }, [
    updateData,
    updateContentMutaion.mutate,
    setUpdateTitle,
    setInputDisabled,
  ]);

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
        patchContent((oldFiltered) =>
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
  }, [
    selectionTags,
    selectedEntries,
    selectionTagsInitial,
    setInputDisabled,
    bulkUpdateMutation.mutate,
  ]);

  const removeContentsMutation = useMutation(
    orpc.main.removeContents.mutationOptions({
      onSuccess: (res) => {
        patchContent((old) => old.filter((doc) => !res.includes(doc.id)));
        setSelectedEntries((old) => old.filter((id) => !res.includes(id)));
      },
      onError: () => {
        toast.error("delete contents failed, check console for error");
      },
    }),
  );

  const removeContents = useCallback(
    (keys: string[]) => {
      removeContentsMutation.mutate(keys);
    },
    [removeContentsMutation.mutate],
  );

  const isSelected = useCallback(
    (id: string) => {
      return selectedEntries.includes(id);
    },
    [selectedEntries],
  );

  return {
    // Status for the loading / error / sync states in the UI
    loadState: {
      isPending:
        getAllContentMutation.isPending || getAllContentMutation.isIdle,
      isError: getAllContentMutation.isError,
      message: getAllContentMutation.error?.message,
    },
    syncState: {
      isPending: syncContentsModified.isPending,
      isError: syncContentsModified.isError,
      message: syncContentsModified.error?.message,
    },
    removeContents,
    setFiltered,
    updateContentFunc,
    bulkUpdateContentFunc,
    filterData,
    loadAllContent,
    serverSyncFunc,
    isSelected,
  };
};

export const [ServerProvider, useServerActions] = constate(useServer);
