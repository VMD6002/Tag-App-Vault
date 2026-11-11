import { useState } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { run } from "@/hooks/useGroupActions";
import { orpc } from "@/lib/orpc";

/** "New group" dialog of `/group` (the only place groups are created): a title, the id is generated. */
export default function NewGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const canCreate = !busy && !!title.trim();

  const create = async () => {
    setBusy(true);
    try {
      if (
        await run(
          orpc.groups.create.call({ title: title.trim() }),
          "Group created",
        )
      ) {
        setTitle("");
        onCreated();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="New group"
      description="Add items to it with “Add to group…” in the library. Tags, cover and description can be edited afterwards."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canCreate} onClick={() => void create()}>
            {busy ? "Creating…" : "Create group"}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="new-group-title">Title</Label>
        <Input
          id="new-group-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCreate) void create();
          }}
          placeholder="Group title"
          autoFocus
        />
      </div>
    </ModalShell>
  );
}
