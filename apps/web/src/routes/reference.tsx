import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import TitleHeader from "@/components/craft/TitleHeader";
import reference from "../../../../Notes/TagApp Server Reference.md?raw";

export default function ReferencePage() {
  return (
    <>
      <TitleHeader
        Title="Reference"
        description="How the server stores files and what each folder is for."
      />
      <article className="prose dark:prose-invert mb-10 max-w-none break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {reference}
        </Markdown>
      </article>
    </>
  );
}
