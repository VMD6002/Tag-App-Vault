import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useServerActions } from "../contexts/Server.Context";
import MultipleSelector from "@/components/ui/multiple-selector";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  allAtom,
  anyAtom,
  noneAtom,
  orderByLatestAtom,
  searchAtom,
  tagsAtom,
  typesAtom,
} from "@/atom";
import {
  selectAllAtom,
  selectionEntriesAtom,
  selectionOnAtom,
  selectionTagsAtom,
  selectionTagsInitialAtom,
  toggleSelectionModeAtom,
  unSelectAllAtom,
} from "../atom.selection";

import { filteredAtom, serverTagsAtom } from "../atom";
import { bulkUpdateModalOpenAtom } from "@/components/craft/BulkUpdateModal";
import { contentTypes } from "@tagapp/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useCallback, useMemo } from "react";

export default function Filters() {
  const { setFiltered, removeContents, filterData, serverSyncFunc } =
    useServerActions();

  const tags = useAtomValue(tagsAtom);

  const serverTags = useAtomValue(serverTagsAtom);

  const filtered = useAtomValue(filteredAtom);

  const [search, setSearch] = useAtom(searchAtom);
  const [types, setTypes] = useAtom(typesAtom);
  const [all, setAll] = useAtom(allAtom);
  const [any, setAny] = useAtom(anyAtom);
  const [none, setNone] = useAtom(noneAtom);
  const [orderByLatest, setOrderByLatest] = useAtom(orderByLatestAtom);

  const selectedEntries = useAtomValue(selectionEntriesAtom);
  const selectionOn = useAtomValue(selectionOnAtom);
  const toggleSelectionMode = useSetAtom(toggleSelectionModeAtom);
  const selectAll = useSetAtom(selectAllAtom);
  const unSelectAll = useSetAtom(unSelectAllAtom);

  const setBulkUpdateModalOpen = useSetAtom(bulkUpdateModalOpenAtom);

  const onSelectAllCheckedChange = useCallback(
    (a: boolean) => (a ? selectAll(filtered.map((o) => o.id)) : unSelectAll()),
    [filtered],
  );

  const deleteSelected = useCallback(() => {
    if (!confirm(`U sure u want to delete ${selectedEntries.length} items ?`))
      return;
    removeContents(selectedEntries);
  }, [selectedEntries]);

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
  }, [selectedEntries, filtered]);

  const openBulkUpdateModal = useCallback(() => {
    syncSelectedTags();
    setBulkUpdateModalOpen(true);
  }, [syncSelectedTags]);

  const tagsForMultiSelectComponent = useMemo(
    () =>
      serverTags.sort().map((o: string) => ({
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
        label: o + ":*",
        value: o + ":*",
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

  return (
    <>
      <Input
        value={search}
        onChange={(a) => setSearch(a.target.value)}
        placeholder="Search"
        className="mb-4"
      />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <MultipleSelector
          value={types}
          onChange={setTypes}
          options={contentTypes.map((o) => ({ label: o, value: o }))}
          placeholder={"All of these Content Types"}
        />
        <MultipleSelector
          value={any}
          onChange={setAny}
          options={anyAndNoneTagsForMuliSelectComponent}
          placeholder={"Any of these tags"}
        />
        <MultipleSelector
          value={none}
          onChange={setNone}
          options={anyAndNoneTagsForMuliSelectComponent}
          placeholder={"None of these tags"}
        />
        <MultipleSelector
          value={all}
          onChange={setAll}
          options={tagsForMultiSelectComponent}
          placeholder={"All of these tags"}
        />
      </div>
      <div className="mb-4 gap-2 flex justify-between flex-wrap items-center">
        <Button onClick={filterData} className="w-full max-w-2xs">
          Filter
        </Button>
        {!!tags ? (
          <Button onClick={serverSyncFunc} className="w-fit">
            Sync
          </Button>
        ) : (
          <>
            <span className="font-mono text-base">{filtered.length}</span>
            <div className="flex space-x-3">
              <Label>Order By Latest</Label>
              <Switch
                checked={orderByLatest}
                onCheckedChange={(a) => {
                  setFiltered((old) => [...old].reverse());
                  setOrderByLatest(a);
                }}
              />
            </div>
          </>
        )}
      </div>
      {!!tags && (
        <div className="flex justify-between mb-4 items-center flex-wrap-reverse gap-y-3">
          <div className="flex items-center space-x-5">
            <Button onClick={toggleSelectionMode} variant="outline">
              Toggle Selection Mode
            </Button>
            <span className="font-mono text-base">{filtered.length}</span>
            {selectionOn ? (
              <>
                <div className="flex space-x-3">
                  <Label>Select All</Label>
                  <Checkbox
                    checked={selectedEntries.length === filtered.length}
                    onCheckedChange={onSelectAllCheckedChange}
                  />
                </div>
                <span className="font-mono text-base">
                  {selectedEntries.length}
                </span>
              </>
            ) : (
              <></>
            )}
          </div>
          <div className="flex space-x-3">
            <Label>Order By Latest</Label>
            <Switch
              checked={orderByLatest}
              onCheckedChange={(a) => {
                setFiltered((old) => [...old].reverse());
                setOrderByLatest(a);
              }}
            />
          </div>
        </div>
      )}
      {selectionOn ? (
        <div>
          <Button
            disabled={selectedEntries.length < 1}
            onClick={openBulkUpdateModal}
            className="mb-4 mr-4"
            variant="outline"
          >
            Update Selected
          </Button>
          <Button
            disabled={selectedEntries.length < 1}
            onClick={deleteSelected}
            className="mb-4"
            variant="outline"
          >
            Delete Selected
          </Button>
        </div>
      ) : (
        <></>
      )}
      <div className="mb-10" />
    </>
  );
}
