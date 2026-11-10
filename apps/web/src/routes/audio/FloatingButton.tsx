import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import FloatingToolbar from "@/components/craft/FloatingToolbar";
import { useDoc } from "../contexts/Doc.Context";
import { audiosAtom, currentModeAtom, selectedContentAtom } from "./atom";

export default function FloatingButtons() {
  const { orpc, doc } = useDoc();

  const [galleryData, setGalleryData] = useAtom(audiosAtom);
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [mode, setMode] = useAtom(currentModeAtom);

  const removeContentMutation = useMutation(
    orpc.audio.removeAudioContents.mutationOptions({
      onSuccess: (res) => {
        setGalleryData(res);
        setSelected([]);
      },
    }),
  );

  const removeAudioContents = () => {
    if (!selected.length) {
      toast.warning("No items selected");
      return;
    }
    void confirm
      .destructive({
        title: `Delete ${selected.length} ${selected.length === 1 ? "track" : "tracks"}?`,
        description:
          "The selected tracks will be deleted from this item's folder on the server. This can't be undone.",
        confirmText: "Delete",
      })
      .then((ok) => {
        if (ok)
          removeContentMutation.mutate({
            name: doc.title,
            id: doc.id,
            contents: selected,
          });
      });
  };

  return (
    <FloatingToolbar
      mode={mode}
      noun="tracks"
      selectedCount={selected.length}
      total={galleryData.length}
      onToggleCover={() =>
        setMode((old) => (old === "cover" ? "view" : "cover"))
      }
      onToggleSelect={() => {
        setSelected([]);
        setMode((old) => (old === "delete" ? "view" : "delete"));
      }}
      onSelectAll={() => {
        if (galleryData.length === selected.length) {
          setSelected([]);
          return;
        }
        confirm({
          title: "Select all tracks?",
          description: `Selects all ${galleryData.length} tracks so you can delete them together.`,
          confirmText: "Select all",
        }).then((ok) => {
          if (ok) setSelected(galleryData.map((e) => e.name));
        });
      }}
      onDelete={removeAudioContents}
    />
  );
}
