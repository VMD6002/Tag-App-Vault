import z from "zod";
import { ArrayHasAll, ArrayHasAnyModified } from "@tagapp/utils";
import Fuse from "fuse.js";
import type {
  ContentServerDataType,
  ContentServerType,
} from "@tagapp/utils/types";

export const FilterQuerySchema = z.object({
  any: z.string().array(), // 1st array - content with at least one of these tags
  all: z.string().array(), // 2nd array - content with all these tags
  none: z.string().array(), // 3rd array - content without any of these tags
  search: z.string(), // string for title search
  types: z.string().array(), // array of types to include (e.g., ["img", "video"])
  orderByLatest: z.boolean(),
});

export type FilterQueryType = z.infer<typeof FilterQuerySchema>;

function GetSearchIds(ids: ContentServerType[], search: string) {
  const fuse = new Fuse(ids, {
    keys: ["title"],
    threshold: 0.5,
    shouldSort: false,
  });
  const fuseResults = fuse.search(search);
  const finalResults = fuseResults.map((fuseObj) => fuseObj.item);
  return finalResults;
}

export function filterData(
  filterData: FilterQueryType,
  contentData: ContentServerDataType,
) {
  const { any, all, none, search, types, orderByLatest } = filterData;
  const hasAny = !!any?.length;
  const hasAll = !!all?.length;
  const hasNone = !!none?.length;
  const allTypes = !types.length;

  const keys = Object.keys(contentData);
  const results: ContentServerType[] = [];

  for (const key of keys) {
    const item = contentData[key]!;
    if (!allTypes && !types.includes(item.type)) continue;
    const tags = item.tags;

    // apply all filters in one pass
    if (hasAny && !ArrayHasAnyModified(tags, any)) continue;
    if (hasNone && ArrayHasAnyModified(tags, none)) continue;
    if (hasAll && !ArrayHasAll(tags, all)) continue;

    results.push(item);
  }

  // run search last (expensive)
  const preFinalResult =
    search && search.trim().length > 0
      ? GetSearchIds(results, search)
      : results;

  const finalResult = orderByLatest
    ? preFinalResult.sort((a, b) => b.added - a.added)
    : preFinalResult.sort((a, b) => a.added - b.added);

  return finalResult;
}
