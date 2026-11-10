import { useAtomValue, useSetAtom } from "jotai";
import { Library as LibraryIcon, RefreshCw, SearchX } from "lucide-react";
import { useEffect } from "react";
import {
  filterActiveAtom,
  initializeFilterDataFromURLAtom,
  resetFilterAtom,
  tagsAtom,
} from "@/atom";
import BulkUpdateModal from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import TitleHeader from "@/components/craft/TitleHeader";
import UpdateModal from "@/components/craft/UpdateModal";
import { Button } from "@/components/ui/button";
import TIMEOUTS from "@/lib/TIMEOUTS";
import { filteredAtom } from "./atom";
import ExtendedCard from "./components/ExtendedCard";
import Filters from "./components/Filters";
import { ServerProvider, useServerActions } from "./contexts/Server.Context";

function Child() {
  const {
    updateContentFunc,
    bulkUpdateContentFunc,
    filterData,
    loadAllContent,
    serverSyncFunc,
    loadState,
    syncState,
  } = useServerActions();

  const tags = useAtomValue(tagsAtom);

  const filtered = useAtomValue(filteredAtom);
  const filterActive = useAtomValue(filterActiveAtom);

  const initializeFilterDataFromURL = useSetAtom(
    initializeFilterDataFromURLAtom,
  );
  const reset = useSetAtom(resetFilterAtom);

  useEffect(() => {
    initializeFilterDataFromURL();
    TIMEOUTS.clearAllTimeouts();
    TIMEOUTS.setTimeout(() => loadAllContent(), 100);
  }, [initializeFilterDataFromURL, loadAllContent]);

  const resetAll = () => {
    reset();
    filterData();
  };

  const syncLibrary = () =>
    confirm({
      title: "Sync new items into the library?",
      description:
        "Moves everything waiting in the server's Sync folder into the library, then reloads this list. Files the server can't read are moved to its UnSyncable folder instead.",
      confirmText: "Sync now",
    }).then((ok) => {
      if (ok) serverSyncFunc();
    });

  return (
    <>
      {!!tags && (
        <>
          <UpdateModal updateContentFunc={updateContentFunc} />
          <BulkUpdateModal bulkUpdateContentFunc={bulkUpdateContentFunc} />
        </>
      )}
      <TitleHeader
        Title="Library"
        description={
          tags
            ? "Everything saved on this server. Search by title, or narrow down by type and tags."
            : "Everything saved on this server. Editing, removing and syncing show up when the TagApp browser extension is connected."
        }
        onTitleClick={resetAll}
        titleHint="Reset all filters and reload"
      >
        {!!tags && (
          <>
            {syncState.isError && (
              <span role="alert" className="text-xs text-destructive">
                Sync failed{syncState.message ? `: ${syncState.message}` : ""}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={syncState.isPending}
              onClick={syncLibrary}
              title="Move everything waiting in the server's Sync folder into the library"
            >
              <RefreshCw
                className={syncState.isPending ? "animate-spin" : ""}
              />
              {syncState.isPending ? "Syncing…" : "Sync library"}
            </Button>
          </>
        )}
      </TitleHeader>
      <Filters />
      {loadState.isError ? (
        <ErrorState
          title="Couldn't load the library"
          message={loadState.message}
          onRetry={() => loadAllContent()}
        />
      ) : loadState.isPending && filtered.length === 0 ? (
        <LoadingState label="Loading the library…" />
      ) : filtered.length === 0 ? (
        filterActive ? (
          <EmptyState
            icon={SearchX}
            title="No items match these filters"
            description="Try removing a tag or type, or shortening the search."
          >
            <Button variant="outline" size="sm" onClick={resetAll}>
              Clear filters and show everything
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={LibraryIcon}
            title="The library is empty"
            description="Downloaded items appear here after you sync them from the server's Sync folder."
          />
        )
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {filtered.map((data) => (
            <ExtendedCard key={data.id} Content={data} />
          ))}
        </div>
      )}
    </>
  );
}

export default function Library() {
  return (
    <ServerProvider>
      <Child />
    </ServerProvider>
  );
}
