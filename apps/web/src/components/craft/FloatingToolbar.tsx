import { Check, Image, ListChecks, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FileMode = "view" | "cover" | "delete";

/**
 * Floating actions for a gallery / audio item: pick a cover, or select files to delete.
 * Presentational only; the caller owns the mode, the selection and every handler.
 */
export default function FloatingToolbar({
  mode,
  onToggleCover,
  onToggleSelect,
  selectedCount,
  total,
  onSelectAll,
  onDelete,
  noun = "files",
}: {
  mode: FileMode;
  onToggleCover: () => void;
  onToggleSelect: () => void;
  selectedCount: number;
  total: number;
  /** Selects everything, or clears the selection when everything is already selected. */
  onSelectAll: () => void;
  onDelete: () => void;
  noun?: string;
}) {
  const allSelected = total > 0 && selectedCount === total;
  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${noun}`}
      className="fixed right-4 bottom-4 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-1 border bg-popover p-1 text-popover-foreground shadow-lg sm:right-6 sm:bottom-6"
    >
      {mode === "cover" && (
        <span className="px-2 text-xs text-muted-foreground">
          Click an image to use it as the cover
        </span>
      )}
      {mode === "delete" && (
        <>
          <span className="px-2 text-xs text-muted-foreground tabular-nums">
            {selectedCount} of {total} selected
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSelectAll}
            title={
              allSelected
                ? "Clear the selection"
                : `Select all ${total} ${noun}`
            }
          >
            <Check />
            {allSelected ? "Select none" : "Select all"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            title={`Delete the selected ${noun} from the server`}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
            Delete selected
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant={mode === "cover" ? "default" : "outline"}
        aria-pressed={mode === "cover"}
        onClick={onToggleCover}
        title={
          mode === "cover"
            ? "Stop choosing a cover"
            : "Choose one of the images below as this item's cover"
        }
      >
        <Image />
        {mode === "cover" ? "Done" : "Choose cover"}
      </Button>
      <Button
        size="sm"
        variant={mode === "delete" ? "default" : "outline"}
        aria-pressed={mode === "delete"}
        onClick={onToggleSelect}
        title={
          mode === "delete"
            ? "Stop selecting and clear the selection"
            : `Select ${noun} to delete them`
        }
      >
        <ListChecks />
        {mode === "delete" ? "Done selecting" : `Select ${noun}`}
      </Button>
    </div>
  );
}
