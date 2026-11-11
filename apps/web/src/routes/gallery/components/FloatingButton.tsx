import { useMutation } from "@tanstack/react-query";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "sonner";
import BulkUpdateModal, {
  bulkUpdateModalOpenAtom,
} from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import FloatingToolbar from "@/components/craft/FloatingToolbar";
import {
  selectionTagsAtom,
  selectionTagsInitialAtom,
} from "../../atom.selection";
import { useDoc } from "../../contexts/Doc.Context";
import { currentModeAtom, galleryDataAtom, selectedContentAtom } from "./atom";
import type { GalleryFilter } from "./useGalleryFilter";

export default function FloatingButtons({ filter }: { filter: GalleryFilter }) {
  const { orpc, doc } = useDoc();

  const setGalleryData = useSetAtom(galleryDataAtom);
  const visible = filter.filtered;
  const [selected, setSelected] = useAtom(selectedContentAtom);
  const [mode, setMode] = useAtom(currentModeAtom);

  const galleryData = useAtomValue(galleryDataAtom);
  const setModalOpen = useSetAtom(bulkUpdateModalOpenAtom);
  const [selectionTags, setSelectionTags] = useAtom(selectionTagsAtom);
  const [initialTags, setInitialTags] = useAtom(selectionTagsInitialAtom);
  // The modal's open state is shared with the library page, so never leave it open behind us
  useEffect(() => () => setModalOpen(false), [setModalOpen]);

  const bulkTagsMutation = useMutation(
    orpc.gallery.bulkUpdateContentTags.mutationOptions({
      onSuccess: (res) => {
        setGalleryData(res);
        setModalOpen(false);
      },
      onError: (err) => toast.error(err?.message || "Failed to update tags"),
    }),
  );

  const openTagsModal = () => {
    // Pre-fill with the tags every selected file has, like the library
    const chosen = galleryData.filter((e) => selected.includes(e.name));
    const shared = chosen
      .slice(1)
      .reduce(
        (acc, e) => acc.filter((t) => (e.tags ?? []).includes(t)),
        chosen[0]?.tags ?? [],
      );
    setInitialTags(shared);
    setSelectionTags(shared.map((t) => ({ label: t, value: t })));
    setModalOpen(true);
  };

  const saveTags = () => {
    const next = selectionTags.map((t) => t.value);
    const add = next.filter((t) => !initialTags.includes(t));
    const remove = initialTags.filter((t) => !next.includes(t));
    if (!add.length && !remove.length) {
      setModalOpen(false);
      return;
    }
    bulkTagsMutation.mutate({
      name: doc.title,
      id: doc.id,
      contents: selected,
      add,
      remove,
    });
  };

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
    <>
      <BulkUpdateModal
        bulkUpdateContentFunc={saveTags}
        noun="files"
        pending={bulkTagsMutation.isPending}
      />
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
            description: `Selects all ${visible.length} files so you can tag or delete them together.`,
            confirmText: "Select all",
          }).then((ok) => {
            if (ok) setSelected(visible.map((e) => e.name));
          });
        }}
        onDelete={removeGalleryContents}
        onEditTags={openTagsModal}
      />
    </>
  );
}
