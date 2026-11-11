import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { toast } from "sonner";
import { confirm } from "@/components/craft/confirm-dialog";
import FloatingToolbar from "@/components/craft/FloatingToolbar";
import { useDoc } from "../../contexts/Doc.Context";
import { currentModeAtom, galleryDataAtom, selectedContentAtom } from "./atom";
import type { GalleryFilter } from "./useGalleryFilter";

export default function FloatingButtons({ filter }: { filter: GalleryFilter }) {
  const { orpc, doc } = useDoc();

  const setGalleryData = useSetAtom(galleryDataAtom);
  const visible = filter.filtered;
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [mode, setMode] = useAtom(currentModeAtom);

  const removeContentMutation = useMutation(
    orpc.gallery.removeGalleryContents.mutationOptions({
      onSuccess: (res) => {
        setSelected([]);
        setGalleryData(res);
      },
    }),
  );
  const removeGalleryContents = () => {
    if (!selected.length) {
      toast.warning("No items selected");
      return;
    }
    void confirm
      .destructive({
        title: `Delete ${selected.length} ${selected.length === 1 ? "file" : "files"}?`,
        description:
          "The selected files will be deleted from this gallery's folder on the server. This can't be undone.",
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
      noun="files"
      selectedCount={selected.length}
      total={visible.length}
      onToggleCover={() =>
        setMode((old) => (old === "cover" ? "view" : "cover"))
      }
      onToggleSelect={() => {
        setSelected([]);
        setMode((old) => (old === "delete" ? "view" : "delete"));
      }}
      onSelectAll={() => {
        if (visible.length === selected.length) {
          setSelected([]);
          return;
        }
        confirm({
          title: "Select all files?",
          description: `Selects all ${visible.length} files so you can delete them together.`,
          confirmText: "Select all",
        }).then((ok) => {
          if (ok) setSelected(visible.map((e) => e.name));
        });
      }}
      onDelete={removeGalleryContents}
    />
  );
}
