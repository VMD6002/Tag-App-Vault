import { contentTypes } from "@tagapp/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  allAtom,
  anyAtom,
  noneAtom,
  orderByLatestAtom,
  realtimeFilterAtom,
  resetFilterAtom,
  searchAtom,
  tagsAtom,
  typesAtom,
} from "@/atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import { typeInfo } from "@/components/craft/library/ContentCard";
import {
  FilterField,
  FilterPanel,
  ResultsBar,
} from "@/components/craft/library/FilterPanel";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { filteredAtom, serverTagsAtom } from "../atom";
import {
  selectAllAtom,
  selectionEntriesAtom,
  selectionOnAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
  toggleSelectionModeAtom,
  unSelectAllAtom,
} from "../atom.selection";
import { useServerActions } from "../contexts/Server.Context";

export default function Filters() {
  const { setFiltered, removeContents, filterData } = useServerActions();

  const tags = useAtomValue(tagsAtom);

  const serverTags = useAtomValue(serverTagsAtom);

  const filtered = useAtomValue(filteredAtom);

  const [search, setSearch] = useAtom(searchAtom);
  const [types, setTypes] = useAtom(typesAtom);
  const [all, setAll] = useAtom(allAtom);
  const [any, setAny] = useAtom(anyAtom);
  const [none, setNone] = useAtom(noneAtom);
  const [orderByLatest, setOrderByLatest] = useAtom(orderByLatestAtom);
  const [realtime, setRealtime] = useAtom(realtimeFilterAtom);
  const reset = useSetAtom(resetFilterAtom);

  const selectedEntries = useAtomValue(selectionEntriesAtom);
  const selectionOn = useAtomValue(selectionOnAtom);
  const toggleSelectionMode = useSetAtom(toggleSelectionModeAtom);
  const selectAll = useSetAtom(selectAllAtom);
  const unSelectAll = useSetAtom(unSelectAllAtom);

  const setBulkUpdateModalOpen = useSetAtom(bulkUpdateModalOpenAtom);

  const onSelectAllCheckedChange = useCallback(
    (a: boolean) => (a ? selectAll(filtered.map((o) => o.id)) : unSelectAll()),
    [filtered, unSelectAll, selectAll],
  );

  const deleteSelected = useCallback(
    () =>
      confirm
        .destructive({
          title: `Remove ${selectedEntries.length} ${selectedEntries.length === 1 ? "item" : "items"}?`,
          description:
            "The selected items and their files will be deleted from the server. This can't be undone.",
          confirmText: "Remove",
        })
        .then((ok) => {
          if (ok) removeContents(selectedEntries);
        }),
    [selectedEntries, removeContents],
  );

  const setSelectionTagsInitial = useSetAtom(selectionTagsInitialAtom);
  const setSelectionTags = useSetAtom(selectionTagsAtom);
  const syncSelectedTags = useCallback(() => {
    const TagsArray = filtered
      .filter((o) => selectedEntries.includes(o.id))
      .map((content) => content.tags);

    const Data = TagsArray.reduce((a: string[], b: string[]) =>
      a.filter((c) => b.includes(c)),
    );
    setSelectionTagsInitial(Data);
    setSelectionTags(Data.map((o: string) => ({ label: o, value: o })));
  }, [selectedEntries, filtered, setSelectionTagsInitial, setSelectionTags]);

  const openBulkUpdateModal = useCallback(() => {
    syncSelectedTags();
    setBulkUpdateModalOpen(true);
  }, [syncSelectedTags, setBulkUpdateModalOpen]);

  const tagsForMultiSelectComponent = useMemo(
    () =>
      [...serverTags].sort().map((o: string) => ({
        label: o,
        value: o,
      })),
    [serverTags],
  );

  const anyAndNoneTagsForMuliSelectComponent = useMemo(() => {
    const convertTedParentTags = [
      ...new Set(serverTags.map((o: string) => o.split(":")[0])),
    ]
      .sort()
      .map((o: string) => ({
        label: `${o}:*`,
        value: `${o}:*`,
      }));
    return [
      ...tagsForMultiSelectComponent,
      {
        label: "*",
        value: "*",
      },
      ...convertTedParentTags,
    ];
  }, [tagsForMultiSelectComponent, serverTags]);

  const typeOptions = useMemo(
    () => contentTypes.map((o) => ({ label: typeInfo[o].label, value: o })),
    [],
  );

  const activeCount =
    any.length +
    none.length +
    all.length +
    types.length +
    (search.trim() ? 1 : 0);

  const noneSelected = selectedEntries.length < 1;

  return (
    <>
      <FilterPanel
        search={search}
        onSearchChange={setSearch}
        onApply={() => filterData()}
        realtime={realtime}
        onRealtimeChange={setRealtime}
        onClear={reset}
        activeCount={activeCount}
      >
        <FilterField label="Type" hint="any of these">
          <MultiSelect
            value={types}
            onChange={setTypes}
            options={typeOptions}
            placeholder="All types"
            label="Content types"
          />
        </FilterField>
        <FilterField label="Any of" hint="at least one">
          <MultiSelect
            value={any}
            onChange={setAny}
            options={anyAndNoneTagsForMuliSelectComponent}
            placeholder="Choose tags"
            label="Any of these tags"
          />
        </FilterField>
        <FilterField label="None of" hint="exclude these">
          <MultiSelect
            value={none}
            onChange={setNone}
            options={anyAndNoneTagsForMuliSelectComponent}
            placeholder="Choose tags"
            label="None of these tags"
          />
        </FilterField>
        <FilterField label="All of" hint="must have every one">
          <MultiSelect
            value={all}
            onChange={setAll}
            options={tagsForMultiSelectComponent}
            placeholder="Choose tags"
            label="All of these tags"
          />
        </FilterField>
      </FilterPanel>

      <ResultsBar
        left={
          <>
            {!!tags && (
              <Button
                size="sm"
                variant={selectionOn ? "default" : "outline"}
                aria-pressed={selectionOn}
                onClick={toggleSelectionMode}
                title={
                  selectionOn
                    ? "Stop selecting and clear the selection"
                    : "Pick several items to edit their tags or remove them together"
                }
              >
                <ListChecks />
                {selectionOn ? "Done selecting" : "Select items"}
              </Button>
            )}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {selectionOn ? (
                <>
                  <span className="font-semibold text-foreground tabular-nums">
                    {selectedEntries.length}
                  </span>{" "}
                  of <span className="tabular-nums">{filtered.length}</span>{" "}
                  selected
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground tabular-nums">
                    {filtered.length}
                  </span>{" "}
                  {filtered.length === 1 ? "item" : "items"}
                </>
              )}
            </p>
            {!!tags && selectionOn && (
              <>
                <Label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={
                      filtered.length > 0 &&
                      selectedEntries.length === filtered.length
                    }
                    onCheckedChange={onSelectAllCheckedChange}
                  />
                  Select all
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={noneSelected}
                  onClick={openBulkUpdateModal}
                  title={
                    noneSelected
                      ? "Select items first"
                      : "Add or remove tags on every selected item"
                  }
                >
                  <Pencil />
                  Edit tags
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={noneSelected}
                  onClick={deleteSelected}
                  title={
                    noneSelected
                      ? "Select items first"
                      : "Delete the selected items from the server"
                  }
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                  Remove
                </Button>
              </>
            )}
          </>
        }
        right={
          <>
            <Label htmlFor="order-latest-switch" className="text-sm">
              Newest first
            </Label>
            <Switch
              id="order-latest-switch"
              checked={orderByLatest}
              onCheckedChange={(a) => {
                setFiltered((old) => [...old].reverse());
                setOrderByLatest(a);
              }}
            />
          </>
        }
      />
    </>
  );
}
