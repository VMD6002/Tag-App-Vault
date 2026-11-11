import type { ContentServerType } from "@tagapp/utils/types";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FolderOpen, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import {
  clearFilterForNavigationAtom,
  initializeFilterDataFromURLAtom,
  resetFilterAtom,
  tagsAtom,
} from "@/atom";
import AddToGroupModal from "@/components/craft/AddToGroupModal";
import BulkUpdateModal from "@/components/craft/BulkUpdateModal";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import DeleteGroupModal from "@/components/craft/group/DeleteGroupModal";
import GroupEditModal from "@/components/craft/group/GroupEditModal";
import GroupHeader from "@/components/craft/group/GroupHeader";
import GroupStatsModal from "@/components/craft/group/GroupStatsModal";
import UpdateModal from "@/components/craft/UpdateModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { run, useGroupActions } from "@/hooks/useGroupActions";
import { useGroupCover } from "@/hooks/useGroupCover";
import { getCoverUrl } from "@/lib/coverUrl";
import { orpc } from "@/lib/orpc";
import TIMEOUTS from "@/lib/TIMEOUTS";
import { allContentAtom, allGroupsAtom, filteredAtom } from "../atom";
import {
  coverModeAtom,
  selectionEntriesAtom,
  selectionOnAtom,
} from "../atom.selection";
import { confirmCover } from "../components/CoverPanel";
import ExtendedCard from "../components/ExtendedCard";
import Filters from "../components/Filters";
import ItemGroupsField from "../components/ItemGroupsField";
import { ServerProvider, useServerActions } from "../contexts/Server.Context";

const BACK = (
  <Link
    href="/group"
    className={buttonVariants({ variant: "outline", size: "sm" })}
  >
    All groups
  </Link>
);

function Child({ id }: { id: string }) {
  const {
    updateContentFunc,
    bulkUpdateContentFunc,
    filterData,
    loadAllContent,
    loadState,
  } = useServerActions();
  const [, navigate] = useLocation();
  const tags = useAtomValue(tagsAtom);
  const filtered = useAtomValue(filteredAtom);
  const allContent = useAtomValue(allContentAtom);
  const groups = useAtomValue(allGroupsAtom);
  const group = groups[id];
  const children = useMemo(
    () => allContent.filter((c) => c.groups?.includes(id)),
    [allContent, id],
  );
  const coverOf = useGroupCover();
  const { addToGroups, removeItems, disband, fix, changed } =
    useGroupActions(loadAllContent);
  const setSelection = useSetAtom(selectionEntriesAtom);
  const setSelectionOn = useSetAtom(selectionOnAtom);
  const [coverMode, setCoverMode] = useAtom(coverModeAtom);
  const initializeFilterDataFromURL = useSetAtom(
    initializeFilterDataFromURLAtom,
  );
  const reset = useSetAtom(resetFilterAtom);
  const clearFilter = useSetAtom(clearFilterForNavigationAtom);
  const [editOpen, setEditOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    initializeFilterDataFromURL();
    TIMEOUTS.clearAllTimeouts();
    TIMEOUTS.setTimeout(() => loadAllContent(), 100);
    // The filters live in the URL query and in module atoms: don't let them leak into the library
    return () => {
      clearFilter();
      setCoverMode(false);
    };
  }, [initializeFilterDataFromURL, loadAllContent, clearFilter, setCoverMode]);

  // Cover mode: confirm the clicked item's cover, save it as the group's cover URL, leave the mode
  const pickCover = useCallback(
    async (item: ContentServerType) => {
      const url = getCoverUrl(item);
      if (!url) return void toast.warning("This item has no cover");
      const cover = `/${url}`; // stored covers are plain URLs
      if (!(await confirmCover(cover))) return;
      if (
        await run(orpc.groups.update.call({ id, cover }), "Group cover set")
      ) {
        setCoverMode(false);
        changed();
      }
    },
    [id, changed, setCoverMode],
  );

  const clearSelection = () => {
    setSelection([]);
    setSelectionOn(false);
  };
  const resetAll = () => {
    reset();
    filterData();
  };

  if (!group) {
    return loadState.isError ? (
      <ErrorState
        title="Couldn't load the group"
        message={loadState.message}
        onRetry={() => loadAllContent()}
      />
    ) : loadState.isPending ? (
      <LoadingState label="Loading the group…" />
    ) : (
      <EmptyState
        icon={FolderOpen}
        title="Group not found"
        description={`There is no group with the id "${id}". It may have been disbanded or deleted.`}
        className="py-24"
      >
        {BACK}
      </EmptyState>
    );
  }

  const name = group.title || group.id;
  const items = filtered.flatMap((e) => (e.kind === "item" ? [e.item] : []));

  return (
    <>
      <GroupStatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        group={group}
        items={children}
      />
      {!!tags && (
        <>
          <UpdateModal
            updateContentFunc={updateContentFunc}
            extra={<ItemGroupsField onChanged={loadAllContent} />}
          />
          <AddToGroupModal
            groups={groups}
            addToGroups={async (itemIds, groupIds) => {
              const ok = await addToGroups(itemIds, groupIds);
              if (ok) clearSelection();
              return ok;
            }}
          />
          <BulkUpdateModal bulkUpdateContentFunc={bulkUpdateContentFunc} />
          <GroupEditModal
            group={editOpen ? group : null}
            onClose={() => setEditOpen(false)}
            onSaved={(newId) => {
              if (newId !== id)
                navigate(`/group/${encodeURIComponent(newId)}`, {
                  replace: true,
                });
              else changed();
            }}
          />
          <DeleteGroupModal
            group={deleteOpen ? group : null}
            groups={groups}
            onClose={() => setDeleteOpen(false)}
            onDone={(ok) => {
              setDeleteOpen(false);
              if (ok) navigate("/group");
              else changed();
            }}
          />
        </>
      )}
      <GroupHeader
        group={group}
        count={children.length}
        cover={coverOf(group, children)}
        onStats={() => setStatsOpen(true)}
        onEdit={() => setEditOpen(true)}
        onFix={() => void fix(id)}
        onDisband={() =>
          void confirm
            .destructive({
              title: "Disband this group?",
              description: `"${name}" is removed and its ${children.length} ${children.length === 1 ? "item goes" : "items go"} back to the library. The items are kept.`,
              confirmText: "Disband",
            })
            .then(async (ok) => {
              if (ok && (await disband(id))) navigate("/");
            })
        }
        onDelete={() => setDeleteOpen(true)}
      />
      <Filters
        onRemoveFromGroup={(ids) =>
          void removeItems(id, ids).then((ok) => ok && clearSelection())
        }
      />
      {loadState.isError ? (
        <ErrorState
          title="Couldn't load the group"
          message={loadState.message}
          onRetry={() => loadAllContent()}
        />
      ) : items.length === 0 && loadState.isPending ? (
        <LoadingState label="Loading the group…" />
      ) : items.length === 0 ? (
        children.length > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No items match these filters"
            description="Try removing a tag or type, or shortening the search."
          >
            <Button variant="outline" size="sm" onClick={resetAll}>
              Clear filters and show everything
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="This group is empty"
            description="Use “Add to group…” on items in the library to put them here."
          >
            {BACK}
          </EmptyState>
        )
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {items.map((item) => (
            <ExtendedCard
              key={item.id}
              Content={item}
              onPickCover={coverMode ? pickCover : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** `/group/:id`: the library page scoped to one group's items. Keyed by id so a new group starts clean. */
export default function GroupPage() {
  const id = useRoute("/group/:id")[1]?.id ?? ""; // wouter already decodes it
  return (
    <ServerProvider key={id} groupId={id}>
      <Child id={id} />
    </ServerProvider>
  );
}
