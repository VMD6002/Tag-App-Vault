import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Confirm a new cover: a preview, the cover value (editable) and "Set cover". Open while `value`
 * is a string. `toSrc` maps the value to the preview image URL (default: the value itself).
 */
export default function CoverConfirmModal({
  value,
  onClose,
  onConfirm,
  toSrc = (v) => v,
  label = "Cover URL",
  busy = false,
}: {
  value: string | null;
  onClose: () => void;
  onConfirm: (value: string) => void;
  toSrc?: (value: string) => string;
  label?: string;
  busy?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => setText(value ?? ""), [value]);

  const trimmed = text.trim();
  const src = trimmed ? toSrc(trimmed) : "";

  return (
    <ModalShell
      open={value !== null}
      onClose={onClose}
      title="Set cover"
      description="Check the preview, edit the value if needed, then confirm."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            {busy ? "Saving…" : "Set cover"}
          </Button>
        </>
      }
    >
      <div className="flex min-h-40 items-center justify-center overflow-hidden border bg-muted/40">
        {src && src !== failed ? (
          <img
            className="max-h-[50vh] w-full object-contain"
            src={src}
            alt="Cover preview"
            referrerPolicy="no-referrer"
            onError={() => setFailed(src)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="size-6 opacity-50" aria-hidden />
            {src ? "The image can't be loaded" : "No cover"}
          </span>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cover-confirm-value">{label}</Label>
        <Input
          id="cover-confirm-value"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed && !busy) onConfirm(trimmed);
          }}
        />
      </div>
    </ModalShell>
  );
}
