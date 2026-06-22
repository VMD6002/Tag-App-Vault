import TitleHeader from "@/components/craft/TitleHeader";
import Filters from "./components/Filters";
import ExtendedCard from "./components/ExtendedCard";
import UpdateModal from "@/components/craft/UpdateModal";
import BulkUpdateModal from "@/components/craft/BulkUpdateModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerProvider, useServerActions } from "./contexts/Server.Context";
import { useAtomValue, useSetAtom } from "jotai";
import { filteredAtom } from "./atom";
import TIMEOUTS from "@/lib/TIMEOUTS";
import { initializeFilterDataFromURLAtom, resetFilterAtom } from "@/atom";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

function Child() {
  const { updateContentFunc, bulkUpdateContentFunc, filterData } =
    useServerActions();

  const filtered = useAtomValue(filteredAtom);

  const initializeFilterDataFromURL = useSetAtom(
    initializeFilterDataFromURLAtom,
  );
  const reset = useSetAtom(resetFilterAtom);

  useEffect(() => {
    initializeFilterDataFromURL();
    TIMEOUTS.clearAllTimeouts();
    TIMEOUTS.setTimeout(() => filterData(), 100);
  }, []);

  return (
    <>
      <UpdateModal updateContentFunc={updateContentFunc} />
      <BulkUpdateModal bulkUpdateContentFunc={bulkUpdateContentFunc} />
      <button
        className="w-full hover:cursor-pointer"
        onClick={() => {
          reset();
          filterData();
        }}
      >
        <TitleHeader Title="Server Library" />
      </button>
      <Filters />
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map((data) => (
          <ExtendedCard key={data.id} Content={data} />
        ))}
      </div>
    </>
  );
}

export default function Library() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <Child />
      </ServerProvider>
    </QueryClientProvider>
  );
}
