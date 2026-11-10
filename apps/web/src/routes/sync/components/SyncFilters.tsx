import { contentTypes } from "@tagapp/utils";
import { useMemo } from "react";
import { typeInfo } from "@/components/craft/library/ContentCard";
import {
  FilterField,
  FilterPanel,
} from "@/components/craft/library/FilterPanel";
import MultiSelect from "@/components/craft/MultiSelect";
import type { SyncItem } from "./SyncCard";
import { asOptions, type SyncFilter } from "./useSyncFilter";

const typeOptions = contentTypes.map((o) => ({
  label: typeInfo[o].label,
  value: o,
}));

/** Filter panel whose tag options come from the pending items (not the server's tags). */
export default function SyncFilters({
  filter: { fields, patch, apply, clear, realtime, setRealtime, activeCount },
  contents,
}: {
  filter: SyncFilter;
  contents: Record<string, SyncItem> | undefined;
}) {
  const allTags = useMemo(
    () =>
      [...new Set(Object.values(contents ?? {}).flatMap((c) => c.tags))].sort(),
    [contents],
  );
  const tagOptions = useMemo(() => asOptions(allTags), [allTags]);
  const anyNoneOptions = useMemo(
    () => [
      ...tagOptions,
      { label: "*", value: "*" },
      ...asOptions([...new Set(allTags.map((t) => `${t.split(":")[0]}:*`))]),
    ],
    [allTags, tagOptions],
  );

  return (
    <FilterPanel
      search={fields.search}
      onSearchChange={(search) => patch({ search })}
      onApply={apply}
      realtime={realtime}
      onRealtimeChange={setRealtime}
      onClear={clear}
      activeCount={activeCount}
    >
      <FilterField label="Type" hint="any of these">
        <MultiSelect
          value={fields.types}
          onChange={(types) => patch({ types })}
          options={typeOptions}
          placeholder="All types"
          label="Content types"
        />
      </FilterField>
      <FilterField label="Any of" hint="at least one">
        <MultiSelect
          value={fields.any}
          onChange={(any) => patch({ any })}
          options={anyNoneOptions}
          placeholder="Choose tags"
          label="Any of these tags"
        />
      </FilterField>
      <FilterField label="None of" hint="exclude these">
        <MultiSelect
          value={fields.none}
          onChange={(none) => patch({ none })}
          options={anyNoneOptions}
          placeholder="Choose tags"
          label="None of these tags"
        />
      </FilterField>
      <FilterField label="All of" hint="must have every one">
        <MultiSelect
          value={fields.all}
          onChange={(all) => patch({ all })}
          options={tagOptions}
          placeholder="Choose tags"
          label="All of these tags"
        />
      </FilterField>
    </FilterPanel>
  );
}
