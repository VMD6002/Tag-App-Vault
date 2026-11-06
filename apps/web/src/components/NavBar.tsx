import { Tag } from "lucide-react";
import { Link } from "wouter";
import NavBarLinks from "./NavBarLinks";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-full w-[calc(100%-2rem)] max-w-6xl items-center justify-between gap-3 sm:w-[calc(100%-4rem)]">
        <Link
          to="/"
          aria-label="TagApp home"
          className="flex items-center gap-2 font-semibold tracking-tight outline-none focus-visible:underline"
        >
          <span className="grid size-6 place-items-center border border-foreground">
            <Tag className="size-3.5" aria-hidden />
          </span>
          <span className="max-sm:sr-only">TagApp</span>
        </Link>
        <NavBarLinks />
      </div>
    </header>
  );
}
