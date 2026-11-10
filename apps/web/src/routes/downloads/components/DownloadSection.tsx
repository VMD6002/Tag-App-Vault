import type { ReactNode } from "react";

/** A titled group of cards with its count. */
export default function DownloadSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-2">
      <h2 className="border-b pb-2 text-sm font-semibold">
        {title}{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      </h2>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
        {children}
      </ul>
    </section>
  );
}
