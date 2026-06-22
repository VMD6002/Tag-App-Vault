import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { ModeToggle } from "./mode-toggle";
import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

const Links = [
  { Name: "Library", Path: "/" },
  { Name: "Tags", Path: "/tags" },
  { Name: "Generate JSON", Path: "/generateJsonPage" },
];

export default function NavBarLinks() {
  const currentUrl = useHashLocation()[0];
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {Links.map((link) => (
          <NavigationMenuItem
            key={`Desktop-Nav-Link-${link.Name}`}
            className={"hidden sm:block"}
          >
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <Link
                className={
                  currentUrl === link.Path ? "underline underline-offset-2" : ""
                }
                href={link.Path}
              >
                {link.Name}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
        <div className={"hidden sm:block"}>
          <ModeToggle />
        </div>
        <NavigationMenuItem className={"w-32 sm:hidden"}>
          <NavigationMenuTrigger className="ml-11">Menu</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-4">
              <li>
                {Links.map((link) => (
                  <NavigationMenuLink
                    key={`Mobile-Nav-Link-${link.Name}`}
                    asChild
                  >
                    <Link
                      className={`whitespace-nowrap ${
                        currentUrl === link.Path
                          ? "underline underline-offset-2"
                          : ""
                      }`}
                      href={link.Path}
                    >
                      {link.Name}
                    </Link>
                  </NavigationMenuLink>
                ))}
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <div className={"ml-2 sm:hidden"}>
          <ModeToggle />
        </div>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
