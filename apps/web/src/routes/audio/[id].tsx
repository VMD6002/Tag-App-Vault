import TitleHeader from "@/components/craft/TitleHeader";
import { useDoc } from "../contexts/Doc.Context";
import DocInfoSection from "../components/DocInfoSection";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import AudioCard from "./AudioCard";
import { audiosAtom, currentAtom } from "./atom";
import { useAtom } from "jotai";
import FloatingButtons from "./FloatingButton";
import { useCallback, useEffect } from "react";

export default function AudioPage() {
  const { doc, setCoverMutation, encodedTitle, removeContent, orpc, tags } =
    useDoc();

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
          setCurrent(data[0].name);
      },
    }),
  );

  const getAudioURL = (audio: string) =>
    `/media/Audios/${encodedTitle}/${encodeURIComponent(audio)}`;

  const setCover = useCallback(
    (img?: string) => {
      if (!confirm("Confirm Cover Update")) return;
      setCoverMutation.mutate({ coverPath: img, id: doc.id, name: doc.title });
    },
    [doc.id],
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
      if (!confirm(`Confirm ${cover} removal`)) return;
      removeContentMutation.mutate({
        name: doc.title,
        id: doc.id,
        contents: [".audio-covers/" + cover],
      });
    },
    [doc],
  );

  useEffect(() => {
    getAudioDataMutation.mutate({ name: doc.title, id: doc.id });
  }, [doc]);

  return (
    <>
      <TitleHeader Title="Audio" />
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
            <Button
              variant="destructive"
              className="absolute top-0 right-0 rounded-none rounded-bl backdrop-blur-xs"
              size="icon-lg"
              onClick={() => setCover()}
            >
              <Trash />
            </Button>
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
