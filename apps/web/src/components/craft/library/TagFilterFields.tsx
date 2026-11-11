import { useMemo } from "react";
import MultiSelect from "@/components/craft/MultiSelect";
import { asOptions, type useFilterState } from "@/hooks/useFilterState";
import { FilterField, FilterPanel } from "./FilterPanel";

type Filter = Pick<
  ReturnType<typeof useFilterState>,
  | "fields"
  | "patch"
  | "apply"
  | "clear"
  | "realtime"
  | "setRealtime"
  | "activeCount"
>;

/** FilterPanel with the Type / Any of / None of / All of fields; tag options are the given `tags`. */
export default function TagFilterFields({
  filter: { fields, patch, apply, clear, realtime, setRealtime, activeCount },
  tags,
  typeOptions,
}: {
  filter: Filter;
  tags: string[];
  typeOptions: { label: string; value: string }[];
}) {
  const tagOptions = useMemo(() => asOptions(tags), [tags]);
  const anyNoneOptions = useMemo(
    () => [
      ...tagOptions,
      { label: "*", value: "*" },
      ...asOptions([...new Set(tags.map((t) => `${t.split(":")[0]}:*`))]),
    ],
    [tags, tagOptions],
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
