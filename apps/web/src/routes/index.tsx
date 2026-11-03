import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import {
  initializeFilterDataFromURLAtom,
  resetFilterAtom,
  tagsAtom,
} from "@/atom";
import BulkUpdateModal from "@/components/craft/BulkUpdateModal";
import TitleHeader from "@/components/craft/TitleHeader";
import UpdateModal from "@/components/craft/UpdateModal";
import TIMEOUTS from "@/lib/TIMEOUTS";
import { filteredAtom } from "./atom";
import ExtendedCard from "./components/ExtendedCard";
import Filters from "./components/Filters";
import { ServerProvider, useServerActions } from "./contexts/Server.Context";

function Child() {
  const { updateContentFunc, bulkUpdateContentFunc, filterData } =
    useServerActions();

  const tags = useAtomValue(tagsAtom);

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
      {!!tags && (
        <>
          <UpdateModal updateContentFunc={updateContentFunc} />
          <BulkUpdateModal bulkUpdateContentFunc={bulkUpdateContentFunc} />
        </>
      )}
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
    <ServerProvider>
      <Child />
    </ServerProvider>
  );
}
