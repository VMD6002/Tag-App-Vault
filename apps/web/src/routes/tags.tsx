import TitleHeader from "@/components/craft/TitleHeader";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

type ServerTagType = Record<string, number>;

const TagGroup = ({
  tags,
  parent,
  tagsArray,
}: {
  tags: ServerTagType;
  parent: string;
  tagsArray: string[];
}) => {
  const Children = useMemo(
    () => tagsArray.filter((k) => k.startsWith(parent)).sort(),
    [parent, tagsArray],
  );
  return (
    <div key={`Section-${parent}`} className="mb-3">
      <h2 className="text-xl mb-3 text-foreground">
        {parent.replaceAll("_", " ")} ({Children.length})
      </h2>
      <div className="grid gap-y-1">
        {Children.map((tag) => (
          <span
            key={tag}
            className="bg-secondary text-secondary-foreground rounded-md text-sm shadow-xs px-4 py-2"
          >
            {String(tags[tag]).padStart(3, "0")} |{" "}
            {tag.replace(parent + ":", "").replaceAll("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
};

function Child() {
  const [tags, setTags] = useState<ServerTagType>({});

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
  }, []);

  const tagsArray = useMemo(() => Object.keys(tags), [tags]);

  return (
    <>
      <TitleHeader Title="Server Tags" />
      <div className="grid sm:grid-cols-2 max-w-sm mx-auto mb-20 rounded-md overflow-hidden">
        <Button
          className="rounded-none"
          onClick={() => RemoveUnusedServerTagsMutation.mutate({})}
        >
          Remove Unused Tags
        </Button>
        <Button
          variant="secondary"
          className="rounded-none"
          onClick={() => FixServerTagsMutation.mutate({})}
        >
          Fix Count
        </Button>
      </div>
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 mb-10 rounded">
        <h1 className="text-3xl mb-5 text-foreground">
          Tags ({tagsArray.length})
        </h1>
        {[...new Set(tagsArray.map((tag) => tag.split(":")[0]))]
          .sort()
          .map((parent: string) => (
            <TagGroup
              key={parent}
              parent={parent}
              tags={tags}
              tagsArray={tagsArray}
            />
          ))}
      </div>
    </>
  );
}

export default function ServerTags() {
  return (
    <QueryClientProvider client={queryClient}>
      <Child />
    </QueryClientProvider>
  );
}
