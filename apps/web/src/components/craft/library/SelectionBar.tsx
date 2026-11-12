import { CheckSquare, FolderPlus, Pencil, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** "Select items" / "Done selecting" toggle of the results bar (library, `/group/:id`, `/sync`). */
export function SelectionToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={on ? "default" : "outline"}
      aria-pressed={on}
      onClick={onToggle}
      title={
        on
          ? "Stop selecting and clear the selection"
          : "Pick several items to edit their tags or remove them together"
      }
    >
      {on ? (
        <>
          <X /> Done selecting
        </>
      ) : (
        <>
          <CheckSquare /> Select items
        </>
      )}
    </Button>
  );
}

/**
 * The selection actions: Select all, Edit tags, `children` (page specific buttons), Add to group…
 * and the remove button. Render only while selecting; the caller owns the selection and the handlers.
 */
export function SelectionActions({
  total,
  selected,
  onSelectAll,
  onEditTags,
  onAddToGroup,
  onRemove,
  removeLabel = "Remove",
  removeTitle,
  children,
}: {
  total: number;
  selected: number;
  onSelectAll: (checked: boolean) => void;
  onEditTags: () => void;
  onAddToGroup: () => void;
  onRemove: () => void;
  removeLabel?: string;
  removeTitle: string;
  children?: ReactNode;
}) {
  const none = selected < 1;
  const hint = (text: string) => (none ? "Select items first" : text);
  return (
    <>
      <Label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={total > 0 && selected === total}
          onCheckedChange={onSelectAll}
        />
        Select all
      </Label>
      <Button
        size="sm"
        variant="outline"
        disabled={none}
        onClick={onEditTags}
        title={hint("Add or remove tags on every selected item")}
      >
        <Pencil />
        Edit tags
      </Button>
      {children}
      <Button
        size="sm"
        variant="outline"
        disabled={none}
        onClick={onAddToGroup}
        title={hint("Put the selected items in a group")}
      >
        <FolderPlus />
        Add to group…
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={none}
        onClick={onRemove}
        title={hint(removeTitle)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
        {removeLabel}
      </Button>
    </>
  );
}
