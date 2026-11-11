import { useAtom } from "jotai";
import { itemsOnlyAtom, searchDescriptionAtom, showGroupedAtom } from "@/atom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Library row under the filters: "Show grouped items", the two search modes (they exclude each
 * other: groups and items by title, or items only) and the independent "Search descriptions too".
 */
export default function AdvancedSearch({
  descriptionOnly = false,
}: {
  /** `/group/:id`: only the description switch makes sense there. */
  descriptionOnly?: boolean;
}) {
  const [showGrouped, setShowGrouped] = useAtom(showGroupedAtom);
  const [itemsOnly, setItemsOnly] = useAtom(itemsOnlyAtom);
  const [searchDescription, setSearchDescription] = useAtom(
    searchDescriptionAtom,
  );
  return (
    <div className="order-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-2 sm:order-none sm:col-span-2 sm:row-start-3">
      {!descriptionOnly && (
        <>
          <div className="flex items-center gap-2">
            <Switch
              id="show-grouped-switch"
              checked={showGrouped || itemsOnly}
              disabled={itemsOnly}
              onCheckedChange={setShowGrouped}
            />
            <Label
              htmlFor="show-grouped-switch"
              className="text-sm"
              title={
                itemsOnly
                  ? "Items only search already shows every item"
                  : "List every grouped item, not only those tagged view:in-library"
              }
            >
              Show grouped items
            </Label>
          </div>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Search mode</legend>
            <span className="text-xs text-muted-foreground" aria-hidden>
              Search in
            </span>
            <Button
              size="xs"
              variant={itemsOnly ? "outline" : "default"}
              aria-pressed={!itemsOnly}
              onClick={() => setItemsOnly(false)}
              title="Match group titles and item titles; grouped items stay inside their group"
            >
              Groups and items
            </Button>
            <Button
              size="xs"
              variant={itemsOnly ? "default" : "outline"}
              aria-pressed={itemsOnly}
              onClick={() => setItemsOnly(true)}
              title="Match items directly, including grouped ones; no group cards"
            >
              Items only
            </Button>
          </fieldset>
        </>
      )}
      <div className="flex items-center gap-2">
        <Switch
          id="search-description-switch"
          checked={searchDescription}
          onCheckedChange={setSearchDescription}
        />
        <Label htmlFor="search-description-switch" className="text-sm">
          Search descriptions too
        </Label>
      </div>
    </div>
  );
}
