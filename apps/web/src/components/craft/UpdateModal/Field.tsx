import { Redo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Label row with the optional "reset to the original value" button. */
export default function Field({
  label,
  htmlFor,
  onReset,
  children,
}: {
  label: string;
  htmlFor?: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex min-h-6 items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {onReset && (
          <Button
            onClick={onReset}
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label.toLowerCase()}`}
            title="Reset to the original value"
          >
            <Redo2 />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
