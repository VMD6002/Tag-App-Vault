import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Trash } from "lucide-react";
import { useCallback, useEffect } from "react";
import { confirm } from "@/components/craft/confirm-dialog";
import TitleHeader from "@/components/craft/TitleHeader";
import { Button } from "@/components/ui/button";
import DocInfoSection from "../components/DocInfoSection";
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
      confirm("Confirm Cover Update?").then((ok) => {
        if (ok)
          setCoverMutation.mutate({
            coverPath: img,
            id: doc.id,
            name: doc.title,
          });
      });
    },
    [doc.id, doc.title],
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
      confirm.destructive(`Confirm ${cover} removal`).then((ok) => {
        if (ok)
          removeContentMutation.mutate({
            name: doc.title,
            id: doc.id,
            contents: [`.audio-covers/${cover}`],
          });
      });
    },
    [doc],
  );

  useEffect(() => {
    getAudioDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc]);

  return (
    <>
      <TitleHeader Title="Audio" Suffix={doc.title} />
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 w-full my-6 gap-3 mb-10">
        {audios.map((audio) => (
          <AudioCard
            key={audio.name}
            data={audio}
            updateCover={setCover}
            removeContentCover={removeContentCover}
          />
        ))}
      </div>
      <div className="mb-16">
        <audio className="w-full" controls src={getAudioURL(current)} />
      </div>
      {!!tags && <FloatingButtons />}
    </>
  );
}
