import type { ContentServerType, CType } from "@tagapp/utils/types";
import {
  GalleryVerticalEnd,
  Headphones,
  Image,
  ImageOff,
  type LucideIcon,
  Pencil,
  ScrollText,
  SquarePlay,
  Trash2,
} from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import TagChips from "./TagChips";

export const typeInfo: Record<CType, { label: string; Icon: LucideIcon }> = {
  img: { label: "Image", Icon: Image },
  video: { label: "Video", Icon: SquarePlay },
  gallery: { label: "Gallery", Icon: GalleryVerticalEnd },
  audio: { label: "Audio", Icon: Headphones },
  txt: { label: "Text", Icon: ScrollText },
};

type Props = {
  content: ContentServerType;
  /** Page of the item; without it the title is plain text (items still waiting to sync). */
  url?: string;
  /** Cover image URL; empty when the item has none (or it failed to load). */
  cover: string | null;
  onCoverError?: () => void;
  /** Plays the video in the card instead of showing the cover (used as poster). */
  video?: { src: string; caption?: string };
  selection?: { on: boolean; selected: boolean; onToggle: () => void };
  /** Edit and remove only render when handlers are given (they need the browser extension). */
  onEdit?: () => void;
  onRemove?: () => void;
};

const ContentCard = memo(
  ({
    content,
    url,
    cover,
    onCoverError,
    video,
    selection,
    onEdit,
    onRemove,
  }: Props) => {
    const selectionOn = !!selection?.on;
    const selected = !!selection?.selected;
    const added = new Date(content.added * 1000);
    const { label, Icon } = typeInfo[content.type];

    return (
      <article
        onClick={() => selectionOn && selection?.onToggle()}
        className={cn(
          "group/card relative flex h-fit flex-col border bg-card/40 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_26rem]",
          selected
            ? "border-foreground ring-1 ring-foreground"
            : "hover:border-foreground/30",
          selectionOn && "cursor-pointer",
        )}
      >
        <div className="relative flex min-h-32 items-center justify-center overflow-hidden border-b bg-muted/40">
          {video ? (
            <video
              className="max-h-72 w-full object-contain"
              src={video.src}
              poster={cover ?? undefined}
              preload="none"
              controls
              onClick={(e) => e.stopPropagation()}
            >
              {video.caption && (
                <track
                  src={video.caption}
                  kind="subtitles"
                  srcLang="en"
                  label="English"
                  default
                />
              )}
            </video>
          ) : cover ? (
            <img
              loading="lazy"
              className="max-h-72 w-full object-contain"
              src={cover}
              alt=""
              onError={onCoverError}
            />
          ) : (
            <ImageOff
              className="size-6 text-muted-foreground/50"
              role="img"
              aria-label="No cover"
            />
          )}
          <span className="absolute right-2 bottom-2 flex items-center gap-1 border bg-background/90 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
            <Icon className="size-3" aria-hidden />
            {label}
          </span>
          {selectionOn && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => selection?.onToggle()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${content.title}`}
              className="absolute top-2 left-2 size-5 bg-background/90"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 p-3">
          <div className="min-w-0">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open ${content.title} in a new tab`}
                className="block text-sm leading-snug font-semibold [overflow-wrap:anywhere] hover:underline focus-visible:underline"
              >
                {content.title}
              </a>
            ) : (
              <p className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">
                {content.title}
              </p>
            )}
            <p
              title={`ID: ${content.id}`}
              className="mt-1 truncate font-mono text-[11px] text-muted-foreground"
            >
              {content.id}
            </p>
          </div>
          <TagChips tags={content.tags} limit />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-1.5">
          <time
            dateTime={added.toISOString()}
            className="text-[11px] text-muted-foreground"
          >
            {formatDate(content.added)}
          </time>
          {(onEdit || onRemove) && (
            <div className="flex items-center gap-0.5">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={selectionOn}
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid triggering selection click handler
                    onEdit();
                  }}
                  title="Edit the title, tags and notes"
                  aria-label={`Edit ${content.title}`}
                >
                  <Pencil />
                  Edit
                </Button>
              )}
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={selectionOn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  title="Remove from library"
                  aria-label={`Remove ${content.title}`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        </div>
      </article>
    );
  },
);

ContentCard.displayName = "ContentCard";
export default ContentCard;
