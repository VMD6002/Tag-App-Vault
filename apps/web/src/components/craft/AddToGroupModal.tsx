import type { GroupsDB } from "@tagapp/utils/types";
import { useAtom } from "jotai";
import ModalShell from "@/components/craft/ModalShell";
import { Button } from "@/components/ui/button";
import { addToGroupAtom } from "./AddToGroupModal.atom";
import GroupPicker from "./GroupPicker";

/**
 * "Add to group…" dialog for one item or a selection (mount once per page, set `addToGroupAtom` from `AddToGroupModal.atom`).
 * `addToGroups` is `useGroupActions(...).addToGroups`.
 */
export default function AddToGroupModal({
  groups,
  addToGroups,
}: {
  groups: GroupsDB;
  addToGroups: (
    itemIds: string[],
    groupIds: string[],
    newTitle: string,
  ) => Promise<boolean>;
}) {
  const [ids, setIds] = useAtom(addToGroupAtom);
  const close = () => setIds(null);
  const count = ids?.length ?? 0;

  return (
    <ModalShell
      open={ids !== null}
      onClose={close}
      title="Add to group"
      description={`${count} ${count === 1 ? "item" : "items"}. A grouped item leaves the main library unless it has the view:in-library tag.`}
      footer={
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
      }
    >
      <GroupPicker
        groups={groups}
        onSubmit={async (groupIds, newTitle) => {
          const ok = await addToGroups(ids ?? [], groupIds, newTitle);
          if (ok) close();
          return ok;
        }}
      />
    </ModalShell>
  );
}
