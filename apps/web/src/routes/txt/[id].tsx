import { useMutation, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useSearchParams } from "wouter";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import { Button } from "@/components/ui/button";
import CoverPanel, { confirmCover } from "../components/CoverPanel";
import DocInfoSection from "../components/DocInfoSection";
import ItemHeader from "../components/ItemHeader";
import { useDoc } from "../contexts/Doc.Context";
import { updateTxtAtom, updateTxtModalOpenAtom } from "./atom";
import UpdateTxtModal from "./UpdateTxtModal";

export interface entry {
  name: string;
  type: "video" | "img";
}

const fetchTxt = async (urlPrefix: string, txtName: string) => {
  if (!txtName || txtName === "/media") return "";
  const res = await fetch(`${urlPrefix}/${encodeURIComponent(txtName)}`);

  // Without this IF block, React Query thinks a 404 is "Success"
  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}`);
  }

  return res.text();
};

// Natural sort by name ("Chapter 2" before "Chapter 10")
const sortTxts = (list: string[]) =>
  [...list].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export default function TextPage() {
  const { doc, setCoverMutation, encodedTitle, orpc, tags } = useDoc();

  const setModalOpen = useSetAtom(updateTxtModalOpenAtom);
  const setUpdateTxt = useSetAtom(updateTxtAtom);

  const [media, setMedia] = useState<entry[]>([]);
  const [txts, setTxts] = useState<string[]>([]);

  // Current chapter lives in the URL (?chapter=...) so data refreshes / reloads don't reset it
  const [params, setParams] = useSearchParams();
  const current = params.get("chapter") ?? "";
  const setCurrent = (txt: string, replace = false) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (txt) next.set("chapter", txt);
        else next.delete("chapter");
        return next;
      },
      { replace },
    );

  // Only fall back to the first chapter when the URL's chapter isn't valid
  const applyData = (data: { Media: entry[]; Texts: string[] }) => {
    const sorted = sortTxts(data.Texts);
    setMedia(data.Media);
    setTxts(sorted);
    const cur = new URLSearchParams(location.search).get("chapter") ?? "";
    const valid =
      sorted.includes(cur) || (cur === "/media" && data.Media.length > 0);
    if (!valid) setCurrent(sorted[0] ?? "", true);
  };

  const coverUrl = doc.cover
    ? `/media/Texts/${encodedTitle}/.media/${encodeURIComponent(doc.cover)}`
    : null;

  const getTxtQuery = useQuery({
    queryKey: ["Text", doc.id, current],
    queryFn: () => fetchTxt(`/media/Texts/${encodedTitle}`, current),
  });

  const getTxtDataMutation = useMutation(
    orpc.text.getTxtData.mutationOptions({
      onSuccess: applyData,
    }),
  );

  const updateTxtMutation = useMutation(
    orpc.text.setTxt.mutationOptions({
      onSuccess: () => {
        getTxtQuery.refetch();
        setModalOpen(false);
      },
      onError: () => {
        toast.error("Update Failed");
      },
    }),
  );

  const refreshTxtDataMutation = useMutation(
    orpc.text.refreshTxtData.mutationOptions({
      onSuccess: applyData,
    }),
  );

  useEffect(() => {
    getTxtDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc, getTxtDataMutation.mutate]);

  const currentTxt = getTxtQuery.data ?? "";

  const index = txts.indexOf(current);
  const prev = index > 0 ? txts[index - 1] : undefined;
  const next = index >= 0 ? txts[index + 1] : undefined;

  const goTo = (txt: string) => {
    setCurrent(txt);
    window.scrollTo(0, 0);
  };

  const getMediaURL = (media: string) =>
    `/media/Texts/${encodedTitle}/.media/${encodeURIComponent(media)}`;

  const updateFunc = useCallback(
    (txtContent: string) =>
      updateTxtMutation.mutate({
        name: doc.title,
        id: doc.id,
        txtName: current,
        txtContent: txtContent.replaceAll(
          `${location.origin}/`,
          "https://<SERVER_URL>",
        ),
      }),
    [current, doc, updateTxtMutation.mutate],
  );

  const openModal = useCallback(() => {
    setUpdateTxt(currentTxt);
    setModalOpen(true);
  }, [currentTxt, setModalOpen, setUpdateTxt]);

  const setCover = useCallback(
    (img?: string) =>
      confirmCover(img).then(
        (ok) =>
          ok &&
          setCoverMutation.mutate({
            coverPath: img,
            id: doc.id,
            name: doc.title,
          }),
      ),
    [doc.id, doc.title, setCoverMutation.mutate],
  );

  const chapterLabel = (txt: string) => txt.replace(/\.[^.]+$/, "");
  const loadingData = getTxtDataMutation.isPending || getTxtDataMutation.isIdle;
  const nothingToShow = !loadingData && txts.length === 0 && media.length === 0;

  return (
    <>
      <UpdateTxtModal
        updateFunc={updateFunc}
        fileName={current}
        saving={updateTxtMutation.isPending}
      />
      <ItemHeader
        Title="Text"
        description="Pick a chapter to read it. Media shows the images and videos that come with it."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={refreshTxtDataMutation.isPending}
          onClick={() =>
            refreshTxtDataMutation.mutate({ name: doc.title, id: doc.id })
          }
          title="Rescan this item's folder on the server for added or removed files"
        >
          <RefreshCw
            className={refreshTxtDataMutation.isPending ? "animate-spin" : ""}
          />
          {refreshTxtDataMutation.isPending ? "Refreshing…" : "Refresh files"}
        </Button>
      </ItemHeader>
      <div className="mb-6 grid place-items-center gap-4 sm:flex sm:place-items-start sm:justify-center">
        {coverUrl && (
          <CoverPanel
            src={coverUrl}
            onRemove={tags ? () => setCover() : undefined}
          />
        )}
        <DocInfoSection />
      </div>
      {getTxtDataMutation.isError ? (
        <ErrorState
          title="Couldn't load the chapters"
          message={getTxtDataMutation.error?.message}
          onRetry={() =>
            getTxtDataMutation.mutate({ name: doc.title, id: doc.id })
          }
        />
      ) : loadingData && txts.length === 0 ? (
        <LoadingState label="Loading chapters…" />
      ) : nothingToShow ? (
        <EmptyState
          icon={FileText}
          title="This item has no text files"
          description="Add .md or .txt files to its folder on the server, then press Refresh files."
        />
      ) : (
        <>
          <nav
            aria-label="Chapters"
            className="mx-auto mb-8 flex w-full flex-wrap gap-2"
          >
            {txts.map((txt) => (
              <div className="flex flex-1 basis-40" key={txt}>
                <Button
                  variant={txt === current ? "default" : "secondary"}
                  aria-current={txt === current ? "true" : undefined}
                  className="min-w-0 flex-1 justify-start"
                  onClick={() => setCurrent(txt)}
                  title={txt}
                >
                  <span className="truncate">{chapterLabel(txt)}</span>
                </Button>
                {!!tags && txt === current && (
                  <Button
                    variant="outline"
                    onClick={openModal}
                    title="Edit the text of this chapter"
                    aria-label={`Edit ${chapterLabel(txt)}`}
                  >
                    <Pencil />
                    Edit
                  </Button>
                )}
              </div>
            ))}
            {!!media.length && (
              <Button
                variant={"/media" === current ? "default" : "secondary"}
                aria-current={"/media" === current ? "true" : undefined}
                className="flex-1 basis-40 justify-start"
                onClick={() => setCurrent("/media")}
              >
                Media ({media.length})
              </Button>
            )}
          </nav>
          {getTxtQuery.isError && current !== "/media" ? (
            <ErrorState
              title="Couldn't load this chapter"
              message={getTxtQuery.error?.message}
              onRetry={() => getTxtQuery.refetch()}
            />
          ) : getTxtQuery.isPending && current && current !== "/media" ? (
            <LoadingState label="Loading chapter…" />
          ) : null}
          {currentTxt && (
            <article className="prose prose-lg dark:prose-invert mx-auto mb-8 max-w-[68ch] break-words">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {currentTxt.replaceAll("https://<SERVER_URL>", "/")}
              </Markdown>
            </article>
          )}
          {currentTxt && (prev || next) && (
            <div className="mx-auto mb-10 flex max-w-[68ch] justify-between gap-3">
              {prev ? (
                <Button
                  variant="secondary"
                  onClick={() => goTo(prev)}
                  title={`Previous chapter: ${chapterLabel(prev)}`}
                >
                  <ArrowLeft />
                  <span className="truncate">{chapterLabel(prev)}</span>
                </Button>
              ) : (
                <span />
              )}
              {next && (
                <Button
                  variant="secondary"
                  onClick={() => goTo(next)}
                  title={`Next chapter: ${chapterLabel(next)}`}
                >
                  <span className="truncate">{chapterLabel(next)}</span>
                  <ArrowRight />
                </Button>
              )}
            </div>
          )}
          {current === "/media" && !!media.length && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Click an image to use it as this item's cover.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {media.map((entry) =>
                  entry.type === "img" ? (
                    <button
                      type="button"
                      key={entry.name}
                      onClick={() => setCover(entry.name)}
                      title="Use as cover"
                      aria-label={`Use ${entry.name} as the cover`}
                      className="my-auto w-full cursor-pointer border bg-muted/40"
                    >
                      <img
                        src={getMediaURL(entry.name)}
                        alt=""
                        className="w-full"
                      />
                    </button>
                  ) : (
                    <video
                      key={entry.name}
                      src={getMediaURL(entry.name)}
                      controls
                      className="my-auto w-full border bg-muted/40"
                    />
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
