import {
  contentTypes,
  VIEW_HIDE_IN_LIBRARY_TAG,
  VIEW_IN_LIBRARY_TAG,
} from "@tagapp/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Eye, EyeOff, FolderMinus, ImageIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  allAtom,
  anyAtom,
  groupedInLibraryAtom,
  itemsOnlyAtom,
  noneAtom,
  orderByLatestAtom,
  realtimeFilterAtom,
  resetFilterAtom,
  searchAtom,
  searchDescriptionAtom,
  showGroupedAtom,
  tagsAtom,
  typesAtom,
} from "@/atom";
import { addToGroupAtom } from "@/components/craft/AddToGroupModal.atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import AdvancedSearch from "@/components/craft/library/AdvancedSearch";
import { typeInfo } from "@/components/craft/library/ContentCard";
import {
  FilterField,
  FilterPanel,
  ResultsBar,
} from "@/components/craft/library/FilterPanel";
import {
  SelectionActions,
  SelectionToggle,
} from "@/components/craft/library/SelectionBar";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { entryItems, filteredAtom, serverTagsAtom } from "../atom";
import {
  coverModeAtom,
  prefillSelectionTagsAtom,
  selectAllAtom,
  selectionEntriesAtom,
  selectionOnAtom,
  toggleCoverModeAtom,
  toggleSelectionModeAtom,
  unSelectAllAtom,
} from "../atom.selection";
import { useServerActions } from "../contexts/Server.Context";

/**
 * Filters and results bar. With `onRemoveFromGroup` (`/group/:id`) the selection bar gets
 * "Remove from group", the advanced search shows only the description switch, the
 * delete button says "Delete", and a "Choose cover" toggle sits beside "Select items".
 */
export default function Filters({
  onRemoveFromGroup,
}: {
  onRemoveFromGroup?: (ids: string[]) => void;
} = {}) {
  const inGroup = !!onRemoveFromGroup;
  const { setFiltered, removeContents, filterData, setLibraryTag } =
    useServerActions();

  const tags = useAtomValue(tagsAtom);

  const serverTags = useAtomValue(serverTagsAtom);

  const entries = useAtomValue(filteredAtom);
  // Group cards can't be selected or edited in bulk; selection and the counts work on item rows
  const filtered = useMemo(() => entryItems(entries), [entries]);
  const groupCount = entries.length - filtered.length;

  const [search, setSearch] = useAtom(searchAtom);
  const [types, setTypes] = useAtom(typesAtom);
  const [all, setAll] = useAtom(allAtom);
  const [any, setAny] = useAtom(anyAtom);
  const [none, setNone] = useAtom(noneAtom);
  const [orderByLatest, setOrderByLatest] = useAtom(orderByLatestAtom);
  const [realtime, setRealtime] = useAtom(realtimeFilterAtom);
  const showGrouped = useAtomValue(showGroupedAtom);
  const groupedShown = useAtomValue(groupedInLibraryAtom) === "show";
  const itemsOnly = useAtomValue(itemsOnlyAtom);
  const searchDescription = useAtomValue(searchDescriptionAtom);
  const reset = useSetAtom(resetFilterAtom);
  const setAddToGroup = useSetAtom(addToGroupAtom);

  const selectedEntries = useAtomValue(selectionEntriesAtom);
  const selectionOn = useAtomValue(selectionOnAtom);
  const toggleSelectionMode = useSetAtom(toggleSelectionModeAtom);
  const coverMode = useAtomValue(coverModeAtom);
  const toggleCoverMode = useSetAtom(toggleCoverModeAtom);
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
          title: `${inGroup ? "Delete" : "Remove"} ${selectedEntries.length} ${selectedEntries.length === 1 ? "item" : "items"}?`,
          description:
            "The selected items and their files will be deleted from the server. This can't be undone.",
          confirmText: inGroup ? "Delete" : "Remove",
        })
        .then((ok) => {
          if (ok) removeContents(selectedEntries);
        }),
    [selectedEntries, removeContents, inGroup],
  );

  const prefillSelectionTags = useSetAtom(prefillSelectionTagsAtom);
  const openBulkUpdateModal = useCallback(() => {
    prefillSelectionTags(
      filtered.filter((o) => selectedEntries.includes(o.id)).map((o) => o.tags),
    );
    setBulkUpdateModalOpen(true);
  }, [selectedEntries, filtered, prefillSelectionTags, setBulkUpdateModalOpen]);

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
    (search.trim() ? 1 : 0) +
    (inGroup ? 0 : Number(showGrouped && !groupedShown) + Number(itemsOnly)) +
    Number(searchDescription);

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
        extra={
          <AdvancedSearch
            descriptionOnly={inGroup}
            onShowGroupedChange={() => filterData()}
          />
        }
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
              <SelectionToggle
                on={selectionOn}
                onToggle={toggleSelectionMode}
              />
            )}
            {!!tags && inGroup && (
              <Button
                size="sm"
                variant={coverMode ? "default" : "outline"}
                aria-pressed={coverMode}
                onClick={toggleCoverMode}
                title={
                  coverMode
                    ? "Stop choosing a cover"
                    : "Click an item to use its cover as the group's cover"
                }
              >
                <ImageIcon />
                {coverMode ? "Cancel choosing" : "Choose cover"}
              </Button>
            )}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {coverMode ? (
                "Click an item to use its cover as the group's cover"
              ) : selectionOn ? (
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
                  {groupCount > 0 && (
                    <>
                      ,{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {groupCount}
                      </span>{" "}
                      {groupCount === 1 ? "group" : "groups"}
                    </>
                  )}
                </>
              )}
            </p>
            {!!tags && selectionOn && (
              <SelectionActions
                total={filtered.length}
                selected={selectedEntries.length}
                onSelectAll={onSelectAllCheckedChange}
                onEditTags={openBulkUpdateModal}
                onAddToGroup={() => setAddToGroup(selectedEntries)}
                onRemove={deleteSelected}
                removeLabel={inGroup ? "Delete" : "Remove"}
                removeTitle="Delete the selected items from the server"
              >
                {onRemoveFromGroup && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={noneSelected}
                    onClick={() => onRemoveFromGroup(selectedEntries)}
                    title={
                      noneSelected
                        ? "Select items first"
                        : "Take the selected items out of this group; they are kept"
                    }
                  >
                    <FolderMinus />
                    Remove from group
                  </Button>
                )}
                {inGroup &&
                  (
                    [
                      [true, "Show in library", Eye],
                      [false, "Hide from library", EyeOff],
                    ] as const
                  ).map(([show, label, Icon]) => {
                    // Settings "shown" mode: showing means removing view:hide-in-library
                    const tag = groupedShown
                      ? VIEW_HIDE_IN_LIBRARY_TAG
                      : VIEW_IN_LIBRARY_TAG;
                    const on = groupedShown ? !show : show;
                    return (
                      <Button
                        key={label}
                        size="sm"
                        variant="outline"
                        disabled={noneSelected}
                        onClick={() =>
                          setLibraryTag(
                            selectedEntries,
                            tag,
                            on,
                            `${tag} ${on ? "added to" : "removed from"} ${selectedEntries.length} ${selectedEntries.length === 1 ? "item" : "items"}`,
                          )
                        }
                        title={
                          noneSelected
                            ? "Select items first"
                            : `${on ? "Add" : "Remove"} ${tag} on the selected items`
                        }
                      >
                        <Icon />
                        {label}
                      </Button>
                    );
                  })}
              </SelectionActions>
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
