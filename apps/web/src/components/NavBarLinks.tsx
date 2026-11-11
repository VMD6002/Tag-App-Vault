import { Menu } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";

const Links = [
  { Name: "Library", Path: "/" },
  { Name: "Groups", Path: "/group" },
  { Name: "Sync", Path: "/sync" },
  { Name: "Downloads", Path: "/downloads" },
  { Name: "Tags", Path: "/tags" },
  { Name: "Reference", Path: "/reference" },
  { Name: "Settings", Path: "/settings" },
];

export default function NavBarLinks() {
  const [currentUrl] = useLocation();

  return (
    <div className="flex items-center gap-1.5">
      <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
        {Links.map((link) => (
          <Link
            key={`Desktop-Nav-Link-${link.Name}`}
            href={link.Path}
            aria-current={currentUrl === link.Path ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 px-3",
              currentUrl === link.Path
                ? "bg-muted text-foreground"
                : "text-muted-foreground",
            )}
          >
            {link.Name}
          </Link>
        ))}
      </nav>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <Menu aria-hidden />
            Menu
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {Links.map((link) => (
              <DropdownMenuItem
                key={`Mobile-Nav-Link-${link.Name}`}
                render={
                  <Link
                    href={link.Path}
                    aria-current={currentUrl === link.Path ? "page" : undefined}
                  />
                }
                className={
                  currentUrl === link.Path ? "bg-muted font-medium" : ""
                }
              >
                {link.Name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ModeToggle />
    </div>
  );
}
