import { Button } from "@/components/ui/button";
import { useCallback, useState, type ReactNode } from "react";

export default function SeeMore({ children }: { children: ReactNode }) {
  const [seeMore, setSeeMore] = useState(false);

  const toggleSeeMore = useCallback(() => setSeeMore((old) => !old), []);

  if (!seeMore)
    return (
      <Button
        className="mb-4 underline"
        variant="ghost"
        onClick={toggleSeeMore}
      >
        More ...
      </Button>
    );
  return (
    <>
      {children}
      <Button
        className="mb-4 underline"
        variant="ghost"
        onClick={toggleSeeMore}
      >
        See Less ...
      </Button>
    </>
  );
}
