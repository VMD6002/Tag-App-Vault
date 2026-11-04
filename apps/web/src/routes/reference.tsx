import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import TitleHeader from "@/components/craft/TitleHeader";
import reference from "../../../../Notes/TagApp Server Reference.md?raw";

export default function ReferencePage() {
  return (
    <>
      <TitleHeader Title="Reference" />
      <article className="prose dark:prose-invert max-w-none break-words mb-10">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {reference}
        </Markdown>
      </article>
    </>
  );
}
