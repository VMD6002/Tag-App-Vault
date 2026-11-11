import { FolderOpen } from "lucide-react";
import { Link, useRoute } from "wouter";
import { EmptyState } from "@/components/craft/EmptyState";
import { buttonVariants } from "@/components/ui/button";

/** Stub so group cards resolve; the real group page replaces it. */
export default function GroupPage() {
  const id = useRoute("/group/:id")[1]?.id ?? "";
  return (
    <EmptyState
      icon={FolderOpen}
      title="Group page coming soon"
      description={`Group ${decodeURIComponent(id)} has no page yet.`}
      className="py-24"
    >
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Back to library
      </Link>
    </EmptyState>
  );
}
