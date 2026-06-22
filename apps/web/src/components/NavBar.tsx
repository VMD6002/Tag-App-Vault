import { Link } from "wouter";
import NavBarLinks from "./NavBarLinks";

export default function NavBar() {
  return (
    <nav className="py-4 z-50 bg-background sticky top-0 border-b">
      <div className="flex max-w-4xl w-11/12 mx-auto justify-between items-center">
        <Link
          to="/"
          className="bg-foreground text-background px-4 py-2 font-stretch-condensed text-lg"
        >
          TagApp
        </Link>
        <NavBarLinks />
      </div>
    </nav>
  );
}
