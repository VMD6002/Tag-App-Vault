import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-2 px-4 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-2 grid size-10 place-items-center border bg-muted/50 text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  hint,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-20 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
      {hint && <span className="max-w-sm text-xs">{hint}</span>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  children,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={message}
      className="[&>div:first-child]:border-destructive/40 [&>div:first-child]:text-destructive"
    >
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
      {children}
    </EmptyState>
  );
}
