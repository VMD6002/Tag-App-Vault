import { useDoc } from "../contexts/Doc.Context";
import { useAtom, useAtomValue } from "jotai";
import { currentAtom, currentModeAtom, selectedContentAtom } from "./atom";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useCallback } from "react";
import type { AudioEntry } from "./atom";

export default function AudioCard({
  data,
  updateCover,
  removeContentCover,
}: {
  data: AudioEntry;
  updateCover: (coverPath: string) => void;
  removeContentCover: (cover: string) => void;
}) {
  const { doc, encodedTitle } = useDoc();

  const currentMode = useAtomValue(currentModeAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [current, setCurrent] = useAtom(currentAtom);

  const handleClick = useCallback(() => {
    switch (currentMode) {
      case "view":
        setCurrent(data.name);
        break;
      case "delete":
        setSelected((prev) =>
          prev.includes(data.name)
            ? prev.filter((item) => item !== data.name)
            : [...prev, data.name],
        );
        break;
      case "cover":
        updateCover(data.cover!);
        break;
      default:
        break;
    }
  }, [data, doc, currentMode]);

  const getAudioCover = (cover: string) =>
    `/media/Audios/${encodedTitle}/.audio-covers/${encodeURIComponent(cover)}`;

  return (
    <div
      className={
        "w-full my-auto bg-secondary rounded hover:cursor-pointer relative " +
        (currentMode !== "view"
          ? "border-2 p-3 " +
            (selected.includes(data.name) ? "border-red-500 " : "")
          : current === data.name
            ? "bg-foreground! text-background"
            : "")
      }
    >
      {data.cover && currentMode === "view" && (
        <Button
          variant="destructive"
          className="absolute right-0 rounded-none rounded-bl z-10 backdrop-blur-xs"
          size="icon-lg"
          onClick={() => removeContentCover(data.cover!)}
        >
          <Trash />
        </Button>
      )}
      <button className="size-full text-left" onClick={handleClick}>
        {data.cover && (
          <img
            src={getAudioCover(data.cover)}
            className="w-full min-h-36 mb-2 object-contain"
          />
        )}
        <p className="text-base break-all p-5">{data.name}</p>
      </button>
    </div>
  );
}
