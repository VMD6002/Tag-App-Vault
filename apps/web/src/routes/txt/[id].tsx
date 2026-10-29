import TitleHeader from "@/components/craft/TitleHeader";
import { useDoc } from "../contexts/Doc.Context";
import DocInfoSection from "../components/DocInfoSection";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import UpdateTxtModal from "./UpdateTxtModal";
import { Edit, Trash } from "lucide-react";
import { useSetAtom } from "jotai";
import { updateTxtAtom, updateTxtModalOpenAtom } from "./atom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";

export interface entry {
  name: string;
  type: "video" | "img";
}

/**
 * Stored text files use this placeholder in place of the app's own origin,
 * so links/images stay portable between servers. On display it becomes "/".
 */
const SERVER_URL_PLACEHOLDER = "$SERVER_URL";
const MEDIA_TAB = "/media";

const fetchTxt = async (urlPrefix: string, txtName: string) => {
  if (!txtName || txtName === MEDIA_TAB) return "";
  const res = await fetch(`${urlPrefix}/${encodeURIComponent(txtName)}`);

  // Without this IF block, React Query thinks a 404 is "Success"
  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}`);
  }

  return res.text();
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

export default function TextPage() {
  const { doc, setCoverMutation, encodedTitle, orpc, tags } = useDoc();

  const setModalOpen = useSetAtom(updateTxtModalOpenAtom);
  const setUpdateTxt = useSetAtom(updateTxtAtom);

  const [media, setMedia] = useState<entry[]>([]);
  const [txts, setTxts] = useState<string[]>([]);
  const [current, setCurrent] = useState("");

  const coverUrl = doc.cover
    ? `/media/Texts/${encodedTitle}/.media/${encodeURIComponent(doc.cover)}`
    : null;

  const getTxtQuery = useQuery({
    queryKey: [current, "Text"],
    queryFn: () => fetchTxt(`/media/Texts/${encodedTitle}`, current),
  });

  const getTxtDataMutation = useMutation(
    orpc.text.getTxtData.mutationOptions({
      onSuccess: (data) => {
        setMedia(data.Media);
        setTxts(data.Texts);
        if (!data.Media.length || current !== MEDIA_TAB) {
          setCurrent(data.Texts[0]);
        }
      },
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
      onSuccess: (data) => {
        setMedia(data.Media);
        setTxts(data.Texts);
        if (!current && data.Media.length) return;
        if (!data.Texts.includes(current)) setCurrent(data.Texts[0]);
      },
    }),
  );

  useEffect(() => {
    getTxtDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc]);

  const currentTxt = getTxtQuery.data ?? "";

  // Stored files use a placeholder for the server origin; swap it for "/" to render.
  const renderedTxt = useMemo(
    () => currentTxt.replaceAll(SERVER_URL_PLACEHOLDER, "/"),
    [currentTxt],
  );

  const getMediaURL = (media: string) =>
    `/media/Texts/${encodedTitle}/.media/${encodeURIComponent(media)}`;

  const updateFunc = useCallback(
    (txtContent: string) =>
      updateTxtMutation.mutate({
        name: doc.title,
        id: doc.id,
        txtName: current,
        // Turn absolute links to this site ("https://host/...") back into the portable placeholder.
        // NOTE: the original used `location.href.slice(-1)` (the URL's last character), which
        // replaced every occurrence of that character in the text.
        txtContent: txtContent.replaceAll(
          `${location.origin}/`,
          SERVER_URL_PLACEHOLDER,
        ),
      }),
    [current, doc],
  );

  const openModal = useCallback(() => {
    setUpdateTxt(currentTxt);
    setModalOpen(true);
  }, [currentTxt]);

  const setCover = useCallback(
    (img?: string) =>
      confirm("Confirm Cover Update").then(
        (ok) =>
          ok &&
          setCoverMutation.mutate({
            coverPath: img,
            id: doc.id,
            name: doc.title,
          }),
      ),
    [doc.id, doc.title, setCoverMutation],
  );

  return (
    <>
      <UpdateTxtModal updateFunc={updateFunc} />
      <button
        type="button"
        aria-label="Refresh text files"
        className="w-fit grid mx-auto hover:cursor-pointer"
        onClick={() =>
          refreshTxtDataMutation.mutate({ name: doc.title, id: doc.id })
        }
      >
        <TitleHeader Title="Text" />
      </button>

      <div
        className={
          "grid place-items-center " +
          (coverUrl
            ? "sm:place-items-start place-content-center sm:flex gap-4"
            : "")
        }
      >
        {coverUrl && (
          <div className="relative w-full sm:w-2/5 rounded-sm bg-input/50 max-h-[max(30vh,25rem)] min-h-30 overflow-hidden">
            {!!tags && (
              <Button
                variant="destructive"
                className="absolute top-0 right-0 rounded-none rounded-bl backdrop-blur-xs"
                size="icon-lg"
                aria-label="Remove cover"
                onClick={() => setCover()}
              >
                <Trash />
              </Button>
            )}

            <img
              className="w-full h-full max-h-[max(30vh,25rem)] object-contain"
              src={coverUrl}
              alt="Cover"
            />
          </div>
        )}
        <DocInfoSection />
      </div>

      <div className="flex flex-wrap gap-3 w-full mx-auto my-6 mb-10">
        {txts.map((txt) => (
          <div className="flex flex-1" key={txt}>
            <Button
              variant={txt === current ? "default" : "secondary"}
              className="justify-start rounded-none flex-1"
              onClick={() => setCurrent(txt)}
            >
              {txt.slice(0, -3)}
            </Button>
            {!!tags && txt === current && (
              <Button
                className="rounded-none"
                variant="secondary"
                aria-label="Edit text"
                onClick={openModal}
              >
                <Edit />
              </Button>
            )}
          </div>
        ))}
        {!!media.length && (
          <Button
            variant={current === MEDIA_TAB ? "default" : "secondary"}
            className="justify-start rounded-none flex-1"
            onClick={() => setCurrent(MEDIA_TAB)}
          >
            Media
          </Button>
        )}
      </div>

      {getTxtQuery.isError && (
        <div
          role="alert"
          className="mx-auto mb-4 flex w-11/12 max-w-4xl items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <span>Couldn't load this file. {getTxtQuery.error?.message}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => getTxtQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {renderedTxt && (
        <article className="prose prose-neutral dark:prose-invert mx-auto mb-10 w-11/12 max-w-[68ch] text-base leading-8 [overflow-wrap:break-word] prose-headings:scroll-mt-20 prose-headings:leading-tight prose-p:leading-8 prose-li:leading-8 prose-li:my-1.5 prose-img:mx-auto prose-img:rounded-md prose-pre:overflow-x-auto prose-table:block prose-table:overflow-x-auto">
          <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {renderedTxt}
          </Markdown>
        </article>
      )}

      {current === MEDIA_TAB && !!media.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((entry) =>
            entry.type === "img" ? (
              <button
                key={entry.name}
                type="button"
                title="Set as cover"
                onClick={() => setCover(entry.name)}
                className="w-full my-auto"
              >
                <img
                  src={getMediaURL(entry.name)}
                  alt={entry.name}
                  loading="lazy"
                  className="w-full"
                />
              </button>
            ) : (
              <video
                key={entry.name}
                src={getMediaURL(entry.name)}
                controls
                preload="metadata"
                className="w-full my-auto"
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
