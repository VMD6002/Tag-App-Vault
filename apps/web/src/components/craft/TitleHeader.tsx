import type { ReactNode } from "react";
import { useLayoutEffect } from "react";

type Props = {
  Title: string;
  /** Shown after the title in the browser tab only, e.g. the name of the open item. */
  Suffix?: string;
  /** One line explaining what the page is for. */
  description?: ReactNode;
  /** Page-level actions, aligned to the right. */
  children?: ReactNode;
  /** Makes the title a button (used by the library to reset filters). */
  onTitleClick?: () => void;
  titleHint?: string;
};

export default function TitleHeader({
  Title,
  Suffix,
  description,
  children,
  onTitleClick,
  titleHint,
}: Props) {
  // Sole writer of document.title; a second writer gets overwritten whenever this remounts
  useLayoutEffect(() => {
    document.title = Suffix ? `${Title} - ${Suffix}` : Title;
  }, [Title, Suffix]);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-8 pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">
          {onTitleClick ? (
            <button
              type="button"
              onClick={onTitleClick}
              title={titleHint}
              className="cursor-pointer text-left underline-offset-4 outline-none hover:underline focus-visible:underline"
            >
              {Title}
            </button>
          ) : (
            Title
          )}
        </h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}
