import { contentTypes } from "@tagapp/utils";
import { useMemo } from "react";
import { typeInfo } from "@/components/craft/library/ContentCard";
import TagFilterFields from "@/components/craft/library/TagFilterFields";
import type { SyncItem } from "./SyncCard";
import type { SyncFilter } from "./useSyncFilter";

const typeOptions = contentTypes.map((o) => ({
  label: typeInfo[o].label,
  value: o,
}));

/** Filter panel whose tag options come from the pending items (not the server's tags). */
export default function SyncFilters({
  filter,
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
  return (
    <TagFilterFields filter={filter} tags={allTags} typeOptions={typeOptions} />
  );
}
