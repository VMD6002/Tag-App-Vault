import { useSetAtom } from "jotai";
import { Pencil, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { confirm } from "@/components/craft/confirm-dialog";
import TagChips from "@/components/craft/library/TagChips";
import {
  updateGroupsAtom,
  updateModalOpenAtom,
} from "@/components/craft/UpdateModal/atom";
import { Button } from "@/components/ui/button";
import { useDoc } from "../contexts/Doc.Context";

export default function DocInfoSection() {
  const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
  const setUpdateGroups = useSetAtom(updateGroupsAtom);
  const { tags, removeContent, doc } = useDoc();
  const added = new Date(doc.added * 1000);
  return (
    <aside
      aria-label="Item details"
      className="grid w-full grid-cols-1 content-start gap-4 sm:w-[calc(40%-1rem)]"
    >
      <div className="min-w-0">
        <h2 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">
          {doc.title}
        </h2>
        <p
          title={`ID: ${doc.id}`}
          className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
        >
          {doc.id}
        </p>
        <time
          dateTime={added.toISOString()}
          className="mt-1 block text-xs text-muted-foreground"
        >
          Added{" "}
          {added.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
      </div>
      {!!tags && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUpdateGroups(doc.groups ?? []); // Cancel drops pending group edits
              setUpdateModalOpen(true);
            }}
            title="Edit the title, tags and notes"
          >
            <Pencil />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Delete this item and its files from the server"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() =>
              confirm
                .destructive({
                  title: "Remove this item?",
                  description: `"${doc.title}" and its files will be deleted from the server. This can't be undone.`,
                  confirmText: "Remove",
                })
                .then((ok) => {
                  if (ok) removeContent();
                })
            }
          >
            <Trash2 />
            Remove
          </Button>
        </div>
      )}
      <section aria-label="Tags" className="border-t pt-3">
        <TagChips tags={doc.tags} />
      </section>
      {doc.extraData.trim() && (
        <section aria-label="Notes" className="border-t pt-3">
          <div className="prose prose-sm dark:prose-invert max-w-none [overflow-wrap:anywhere]">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {doc.extraData}
            </Markdown>
          </div>
        </section>
      )}
    </aside>
  );
}
