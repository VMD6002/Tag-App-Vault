import { useLayoutEffect } from "react";

export default function TitleHeader({
  Title,
  Suffix,
}: {
  Title: string;
  Suffix?: string;
}) {
  // Sole writer of document.title; a second writer gets overwritten whenever this remounts
  useLayoutEffect(() => {
    document.title = Suffix ? `${Title} - ${Suffix}` : Title;
  }, [Title, Suffix]);
  return (
    <h1 className="text-center font-stretch-ultra-condensed my-18 mb-20 text-6xl">
      {Title}
    </h1>
  );
}
