import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Music } from "lucide-react";
import { useCallback, useEffect } from "react";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import CoverPanel, { confirmCover } from "../components/CoverPanel";
import DocInfoSection from "../components/DocInfoSection";
import ItemHeader from "../components/ItemHeader";
import { useDoc } from "../contexts/Doc.Context";
import AudioCard from "./AudioCard";
import { audiosAtom, currentAtom } from "./atom";
import FloatingButtons from "./FloatingButton";

export default function AudioPage() {
  const { doc, setCoverMutation, encodedTitle, orpc, tags } = useDoc();

  const [audios, setAudios] = useAtom(audiosAtom);
  const [current, setCurrent] = useAtom(currentAtom);

  const coverUrl = doc.cover
    ? `/media/Audios/${encodedTitle}/.audio-covers/${encodeURIComponent(doc.cover)}`
    : null;

  const getAudioDataMutation = useMutation(
    orpc.audio.getAudioData.mutationOptions({
      onSuccess: (data) => {
        setAudios(data);
        if (!data.map((a) => a.name).includes(current))
          setCurrent(data[0]?.name ?? "");
      },
    }),
  );

  const getAudioURL = (audio: string) =>
    `/media/Audios/${encodedTitle}/${encodeURIComponent(audio)}`;

  const setCover = useCallback(
    (img?: string) => {
      confirmCover(img).then((ok) => {
        if (ok)
          setCoverMutation.mutate({
            coverPath: img,
            id: doc.id,
            name: doc.title,
          });
      });
    },
    [doc.id, doc.title, setCoverMutation.mutate],
  );

  const removeContentMutation = useMutation(
    orpc.audio.removeAudioContents.mutationOptions({
      onSuccess: (data) => {
        setAudios(data);
      },
    }),
  );

  const removeContentCover = useCallback(
    (cover: string) => {
      confirm
        .destructive({
          title: "Delete this cover image?",
          description: `${cover} will be deleted from the server. The track it belongs to is kept.`,
          confirmText: "Delete cover",
        })
        .then((ok) => {
          if (ok)
            removeContentMutation.mutate({
              name: doc.title,
              id: doc.id,
              contents: [`.audio-covers/${cover}`],
            });
        });
    },
    [doc, removeContentMutation.mutate],
  );

  useEffect(() => {
    getAudioDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc, getAudioDataMutation.mutate]);

  const loading = getAudioDataMutation.isPending || getAudioDataMutation.isIdle;

  return (
    <>
      <ItemHeader Title="Audio" description="Choose a track to play it." />
      <div className="mb-6 grid place-items-center gap-4 sm:flex sm:place-items-start sm:justify-center">
        {coverUrl && (
          <CoverPanel
            src={coverUrl}
            onRemove={tags ? () => setCover() : undefined}
          />
        )}
        <DocInfoSection />
      </div>
      {getAudioDataMutation.isError ? (
        <ErrorState
          title="Couldn't load the tracks"
          message={getAudioDataMutation.error?.message}
          onRetry={() =>
            getAudioDataMutation.mutate({ name: doc.title, id: doc.id })
          }
        />
      ) : loading && audios.length === 0 ? (
        <LoadingState label="Loading tracks…" />
      ) : audios.length === 0 ? (
        <EmptyState
          icon={Music}
          title="This item has no audio files"
          description="Add audio files to its folder on the server and reload the page."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {audios.map((audio) => (
              <AudioCard
                key={audio.name}
                data={audio}
                updateCover={setCover}
                removeContentCover={removeContentCover}
              />
            ))}
          </div>
          <section
            aria-label="Player"
            className="mb-20 grid gap-1 border bg-card/40 p-3"
          >
            <p
              className="truncate text-xs text-muted-foreground"
              title={current}
            >
              Now playing: <span className="text-foreground">{current}</span>
            </p>
            <audio className="w-full" controls src={getAudioURL(current)} />
          </section>
        </>
      )}
      {!!tags && <FloatingButtons />}
    </>
  );
}
