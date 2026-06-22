import { useLayoutEffect } from "react";

export default function TitleHeader({ Title }: { Title: string }) {
  useLayoutEffect(() => {
    document.title = Title;
  }, [Title]);
  return (
    <h1 className="text-center font-stretch-ultra-condensed my-18 mb-20 text-6xl">
      {Title}
    </h1>
  );
}
