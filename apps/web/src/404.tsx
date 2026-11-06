import { FileQuestion } from "lucide-react";
import { Link } from "wouter";
import { EmptyState } from "@/components/craft/EmptyState";
import { buttonVariants } from "@/components/ui/button";

export default function PageNotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="This address doesn't match any page."
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
