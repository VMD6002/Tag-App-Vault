import type { GroupType } from "@tagapp/utils/types";
import { useAtomValue } from "jotai";
import {
  BarChart3,
  FolderOpen,
  Pencil,
  Trash2,
  Unlink,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { tagsAtom } from "@/atom";
import TagChips from "@/components/craft/library/TagChips";
import TitleHeader from "@/components/craft/TitleHeader";
import { Button } from "@/components/ui/button";

/** Header of `/group/:id`: title, cover, markdown description, tags and the group actions. */
export default function GroupHeader({
  group,
  count,
  cover,
  onEdit,
  onStats,
  onFix,
  onDisband,
  onDelete,
}: {
  group: GroupType;
  /** Number of items in the group (not the filtered ones). */
  count: number;
  cover: string | null;
  onEdit: () => void;
  onStats: () => void;
  onFix: () => void;
  onDisband: () => void;
  onDelete: () => void;
}) {
  const tags = useAtomValue(tagsAtom);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const shownCover = cover !== failedCover ? cover : null;
  const action = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    title: string,
    destructive = false,
  ) => (
    <Button
      variant={destructive ? "ghost" : "outline"}
      size="sm"
      title={title}
      onClick={onClick}
      className={
        destructive
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : undefined
      }
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <>
      <TitleHeader
        Title={group.title || group.id}
        Suffix="Group"
        description={
          <span className="font-mono text-xs">
            {group.id} · {count} {count === 1 ? "item" : "items"}
          </span>
        }
      >
        {action(
          "Stats",
          <BarChart3 />,
          onStats,
          "Tag counts across the items of this group",
        )}
        {!!tags && (
          <>
            {action(
              "Edit",
              <Pencil />,
              onEdit,
              "Edit the title, description, tags, cover and id",
            )}
            {action(
              "Fix Data",
              <Wrench />,
              onFix,
              "Clear an empty cover string on this group",
            )}
            {action(
              "Disband",
              <Unlink />,
              onDisband,
              "Remove the group and keep its items",
              true,
            )}
            {action(
              "Delete group",
              <Trash2 />,
              onDelete,
              "Delete the group and its items from the server",
              true,
            )}
          </>
        )}
      </TitleHeader>

      <section
        aria-label="Group details"
        className="mb-4 grid gap-3 border bg-card/40 p-3 sm:grid-cols-[10rem_minmax(0,1fr)]"
      >
        <div className="flex min-h-24 items-center justify-center overflow-hidden bg-muted/40">
          {shownCover ? (
            <img
              src={shownCover}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-40 w-full object-contain"
              onError={() => setFailedCover(shownCover)}
            />
          ) : (
            <div
              className="h-24 w-full bg-black"
              role="img"
              aria-label="No cover"
            />
          )}
        </div>
        <div className="grid min-w-0 content-start gap-3">
          {group.extraData.trim() ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [overflow-wrap:anywhere]">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {group.extraData}
              </Markdown>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderOpen className="size-3.5" aria-hidden />
              No description
            </p>
          )}
          <TagChips tags={group.tags} />
        </div>
      </section>
    </>
  );
}
