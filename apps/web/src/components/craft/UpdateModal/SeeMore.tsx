import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export default function SeeMore({ children }: { children: ReactNode }) {
  const [seeMore, setSeeMore] = useState(false);

  const toggleSeeMore = useCallback(() => setSeeMore((old) => !old), []);

  return (
    <>
      {seeMore && <div className="grid gap-4">{children}</div>}
      <Button
        className="w-fit text-muted-foreground"
        variant="ghost"
        size="sm"
        aria-expanded={seeMore}
        onClick={toggleSeeMore}
      >
        {seeMore ? <ChevronUp /> : <ChevronDown />}
        {seeMore ? "Fewer fields" : "More fields"}
      </Button>
    </>
  );
}
