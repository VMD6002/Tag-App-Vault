import { Trash2 } from "lucide-react";
import { confirm } from "@/components/craft/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Confirms setting `img` as the cover, or removing the cover when `img` is undefined. */
export const confirmCover = (img?: string) =>
  img
    ? confirm({
        title: "Use this image as the cover?",
        description: img,
        confirmText: "Set cover",
      })
    : confirm.destructive({
        title: "Remove the cover?",
        description:
          "The item will show without a cover. The image file stays in its folder.",
        confirmText: "Remove cover",
      });

/** The item's cover next to its details. The remove button needs the browser extension (`onRemove`). */
export default function CoverPanel({
  src,
  onRemove,
}: {
  src: string;
  onRemove?: () => void;
}) {
  return (
    <div className="relative min-h-30 w-full overflow-hidden border bg-muted/40 sm:w-2/5">
      {onRemove && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRemove}
          title="Remove this item's cover (the image file is kept)"
          className="absolute top-2 right-2 bg-background/90 text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
          Remove cover
        </Button>
      )}
      <img
        className="max-h-[max(30vh,25rem)] w-full object-contain"
        src={src}
        alt="Cover"
      />
    </div>
  );
}
