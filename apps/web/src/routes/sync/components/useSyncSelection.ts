import { useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { addToGroupAtom } from "@/components/craft/AddToGroupModal.atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import {
  coverModeAtom,
  selectionEntriesAtom,
  selectionOnAtom,
} from "@/routes/atom.selection";

/**
 * The library's selection atoms, scoped to `/sync`: reset on open and on leave (so neither page sees
 * the other's selection or a left-open modal), and the selection drops items the filter or a rescan removed.
 */
export function useSyncSelection(visibleKeys: string[]) {
  const [selected, setSelected] = useAtom(selectionEntriesAtom);
  const setOn = useSetAtom(selectionOnAtom);
  const setCover = useSetAtom(coverModeAtom);
  const setBulkOpen = useSetAtom(bulkUpdateModalOpenAtom);
  const setAddToGroup = useSetAtom(addToGroupAtom);

  useEffect(() => {
    const reset = () => {
      setOn(false);
      setCover(false);
      setSelected([]);
      setBulkOpen(false);
      setAddToGroup(null);
    };
    reset();
    return reset;
  }, [setOn, setCover, setSelected, setBulkOpen, setAddToGroup]);

  useEffect(() => {
    const keep = selected.filter((k) => visibleKeys.includes(k));
    if (keep.length !== selected.length) setSelected(keep);
  }, [visibleKeys, selected, setSelected]);
}
