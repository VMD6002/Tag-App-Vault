import { atom, useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { tagsAtom } from "@/atom";
import ModalShell from "@/components/craft/ModalShell";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectionTagsAtom } from "@/routes/atom.selection";

export const bulkUpdateModalOpenAtom = atom(false);

export default function BlukUpdateModal({
  bulkUpdateContentFunc,
}: {
  bulkUpdateContentFunc: () => void;
}) {
  const tags = useAtomValue(tagsAtom);

  const [modalOpen, setModalOpen] = useAtom(bulkUpdateModalOpenAtom);

  const [selectionTags, setSelectionTags] = useAtom(selectionTagsAtom);
  const close = useCallback(() => setModalOpen(false), [setModalOpen]);

  return (
    <ModalShell
      open={modalOpen}
      onClose={close}
      title="Edit tags on selected items"
      description="Tags shared by every selected item are pre-filled. Add a tag to give it to all of them, or remove one to take it off all of them."
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={bulkUpdateContentFunc}>Save tags</Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label>Tags</Label>
        <MultiSelect
          options={(tags ?? []).map((o) => ({
            label: o,
            value: o,
          }))}
          placeholder="Choose tags"
          label="Tags for the selected items"
          value={selectionTags}
          onChange={setSelectionTags}
        />
      </div>
    </ModalShell>
  );
}
