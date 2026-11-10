import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { confirm } from "@/components/craft/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/craft/EmptyState";
import TitleHeader from "@/components/craft/TitleHeader";
import { TagGroups, TagSearchInput } from "@/components/craft/tags/TagGroups";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

type ServerTagType = Record<string, number>;

export default function ServerTags() {
  const [tags, setTags] = useState<ServerTagType>({});
  const [query, setQuery] = useState("");

  const GetTagsFromServerMutation = useMutation(
    orpc.main.getServerTags.mutationOptions({
      onSuccess: (res) => {
        setTags(res);
      },
    }),
  );

  const FixServerTagsMutation = useMutation(
    orpc.fix.hardResetTagCount.mutationOptions({
      onSuccess: (res) => {
        setTags(res);
      },
    }),
  );

  const RemoveUnusedServerTagsMutation = useMutation(
    orpc.fix.softResetTagCount.mutationOptions({
      onSuccess: (res) => {
        setTags(res);
      },
    }),
  );

  useEffect(() => {
    GetTagsFromServerMutation.mutate({});
  }, [GetTagsFromServerMutation.mutate]);

  const tagCount = Object.keys(tags).length;
  const loading =
    GetTagsFromServerMutation.isPending || GetTagsFromServerMutation.isIdle;
  const busy =
    FixServerTagsMutation.isPending || RemoveUnusedServerTagsMutation.isPending;
  const actionError =
    FixServerTagsMutation.error ?? RemoveUnusedServerTagsMutation.error;

  const removeUnused = () =>
    confirm({
      title: "Remove unused tags?",
      description:
        "Tags that no item uses (count 0) are removed from the tag list. Items are not changed.",
      confirmText: "Remove unused tags",
    }).then((ok) => {
      if (ok) RemoveUnusedServerTagsMutation.mutate({});
    });

  const fixCounts = () =>
    confirm({
      title: "Recount all tags?",
      description:
        "Rebuilds every tag's count from the items that currently use it. Use this if a number looks wrong. Items are not changed.",
      confirmText: "Recount",
    }).then((ok) => {
      if (ok) FixServerTagsMutation.mutate({});
    });

  return (
    <>
      <TitleHeader
        Title="Tags"
        description={`${tagCount} ${tagCount === 1 ? "tag" : "tags"} on this server, grouped by the part before the colon. The number is how many items use the tag.`}
      >
        {actionError && (
          <span role="alert" className="text-xs text-destructive">
            {actionError.message}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          title="Remove tags that no item uses (count 0) from the list"
          onClick={removeUnused}
        >
          {RemoveUnusedServerTagsMutation.isPending
            ? "Removing…"
            : "Remove unused tags"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          title="Recount every tag from the items that use it. Use this if a number looks wrong."
          onClick={fixCounts}
        >
          {FixServerTagsMutation.isPending ? "Recounting…" : "Fix tag counts"}
        </Button>
      </TitleHeader>

      <div className="mb-6">
        <TagSearchInput value={query} onChange={setQuery} />
      </div>

      {GetTagsFromServerMutation.isError ? (
        <ErrorState
          title="Couldn't load tags"
          message={GetTagsFromServerMutation.error?.message}
          onRetry={() => GetTagsFromServerMutation.mutate({})}
        />
      ) : loading && !tagCount ? (
        <LoadingState label="Loading tags…" />
      ) : (
        <TagGroups tags={tags} query={query} />
      )}
    </>
  );
}
