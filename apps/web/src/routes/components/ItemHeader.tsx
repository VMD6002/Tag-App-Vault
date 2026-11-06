import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import TitleHeader from "@/components/craft/TitleHeader";
import { buttonVariants } from "@/components/ui/button";
import { useDoc } from "../contexts/Doc.Context";

/** Small page heading for the item pages: the type, one line of help, and a way back. */
export default function ItemHeader({
  Title,
  description,
  children,
}: {
  Title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  const { doc } = useDoc();
  return (
    <TitleHeader Title={Title} Suffix={doc.title} description={description}>
      {children}
      <Link
        href="/"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft />
        Library
      </Link>
    </TitleHeader>
  );
}
