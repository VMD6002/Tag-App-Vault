import { atom, useAtom, useAtomValue } from "jotai";
import { tagsAtom } from "@/atom";
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
  const tags = useAtomValue(tagsAtom)!;

  const [modalOpen, setModalOpen] = useAtom(bulkUpdateModalOpenAtom);

  const [selectionTags, setSelectionTags] = useAtom(selectionTagsAtom);

  if (!modalOpen) return null;

  return (
    <div
      style={{ zIndex: 2147483647 }}
      className="grid fixed h-screen top-0 right-0 w-full place-items-center"
    >
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={() => setModalOpen(false)}
        className="h-screen absolute w-full bg-black/10 backdrop-blur-xs border-0 cursor-default"
      />
      <div className="max-w-md absolute w-full grid bg-secondary rounded shadow px-8 py-10">
        <Label className="mb-2">Tags</Label>
        <MultiSelect
          options={tags.map((o) => ({
            label: o,
            value: o,
          }))}
          className="mb-4"
          placeholder="Tags"
          value={selectionTags}
          onChange={setSelectionTags}
        />
        <Button
          onClick={bulkUpdateContentFunc}
          className="max-w-sm w-11/12 mx-auto"
        >
          Update
        </Button>
      </div>
    </div>
  );
}
