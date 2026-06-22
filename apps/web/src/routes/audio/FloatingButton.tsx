import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Grid2X2Check, Image, Trash } from "lucide-react";
import { useDoc } from "../contexts/Doc.Context";
import { currentModeAtom, audiosAtom, selectedContentAtom } from "./atom";

export default function FloatingButtons() {
  const { orpc, doc } = useDoc();

  const [galleryData, setGalleryData] = useAtom(audiosAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [mode, setMode] = useAtom(currentModeAtom);

  const removeContentMutation = useMutation(
    orpc.gallery.removeGalleryContents.mutationOptions({
      onSuccess: (res) => {
        setGalleryData(res);
      },
    }),
  );

  const removeGalleryContents = () => {
    if (!selected.length) {
      alert("No items selected");
      return;
    }
    if (!confirm(`Confirm ${selected.length} items deletion`)) return;
    removeContentMutation.mutate({
      name: doc.title,
      id: doc.id,
      contents: selected,
    });
    setSelected([]);
  };

  return (
    <div className="fixed bottom-8 right-8 grid gap-1">
      {mode === "delete" ? (
        <div className="flex gap-1">
          <Button
            onClick={() => {
              if (galleryData.length === selected.length) setSelected([]);
              else if (confirm("Select All ?"))
                setSelected(galleryData.map((e) => e.name));
            }}
            variant="secondary"
            size="icon"
            className={
              "backdrop-blur-xs border-2 size-12 " +
              (selected.length === galleryData.length
                ? "border-foreground!"
                : "")
            }
          >
            {String(selected.length).padStart(2, "0")}
          </Button>
          <Button
            onClick={removeGalleryContents}
            variant="secondary"
            size="icon"
            className="backdrop-blur-xs border-2 border-red-500 size-12"
          >
            <Trash className="text-red-500 scale-125" />
          </Button>
        </div>
      ) : (
        <></>
      )}
      <div className="flex gap-1">
        <Button
          onClick={() => setMode((old) => (old === "cover" ? "view" : "cover"))}
          variant="secondary"
          size="icon"
          className={
            "backdrop-blur-xs border-2 size-12 " +
            (mode === "cover" ? "border-foreground!" : "")
          }
        >
          <Image className="scale-125" />
        </Button>
        <Button
          onClick={() => {
            setSelected([]);
            setMode((old) => (old === "delete" ? "view" : "delete"));
          }}
          variant="secondary"
          size="icon"
          className={
            "backdrop-blur-xs border-2 size-12 " +
            (mode === "delete" ? "border-foreground!" : "")
          }
        >
          <Grid2X2Check className="scale-125" />
        </Button>
      </div>
    </div>
  );
}
