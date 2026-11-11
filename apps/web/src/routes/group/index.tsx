import { childrenByGroup } from "@tagapp/utils";
import type { GroupType } from "@tagapp/utils/types";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
  CheckSquare,
  FolderOpen,
  Merge,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  Unlink,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import DeleteGroupModal from "@/components/craft/group/DeleteGroupModal";
import GroupEditModal from "@/components/craft/group/GroupEditModal";
import MergeGroupsModal from "@/components/craft/group/MergeGroupsModal";
import NewGroupModal from "@/components/craft/group/NewGroupModal";
import GroupCard from "@/components/craft/library/GroupCard";
import TitleHeader from "@/components/craft/TitleHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { run, useGroupActions } from "@/hooks/useGroupActions";
import { orpc } from "@/lib/orpc";

const NO_ITEMS: never[] = [];

/** `/group`: every group, empty ones included. Fix Data, merge, disband and delete (with the extension). */
export default function GroupsPage() {
  const tags = useAtomValue(tagsAtom);
  // Always fresh on open: the library and group pages change this data
  const contentQ = useQuery(
    orpc.main.getAllContent.queryOptions({
      input: {},
      gcTime: 0,
      refetchOnMount: "always",
    }),
  );
  const groupsQ = useQuery(
    orpc.groups.list.queryOptions({
      input: {},
      gcTime: 0,
      refetchOnMount: "always",
    }),
  );
  const refetchContent = contentQ.refetch;
  const reload = useCallback(() => void refetchContent(), [refetchContent]);
  const { disband, fix, changed } = useGroupActions(reload);

  const groups = groupsQ.data;
  const children = useMemo(
    () => childrenByGroup(contentQ.data ?? {}),
    [contentQ.data],
  );
  const [search, setSearch] = useState("");
  const [selectionOn, setSelectionOn] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[] | null>(null);
  const [deleteQueue, setDeleteQueue] = useState<string[]>([]);
  const [deleteTotal, setDeleteTotal] = useState(0);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(groups ?? {})
      .filter(
        (g) =>
          !q ||
          g.title.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q),
      )
      .sort((a, b) => b.added - a.added);
  }, [groups, search]);
  const total = Object.keys(groups ?? {}).length;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(children).map(([k, v]) => [k, v.length]),
      ),
    [children],
  );

  const childTags = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(children).map(([k, v]) => [
          k,
          [...new Set(v.flatMap((c) => c.tags))],
        ]),
      ),
    [children],
  );

  const toggle = (id: string) =>
    setSelected((old) =>
      old.includes(id) ? old.filter((o) => o !== id) : [...old, id],
    );
  const stopSelecting = () => {
    setSelectionOn(false);
    setSelected([]);
  };
  const selectedGroups = list.filter((g) => selected.includes(g.id));

  const disbandMany = (ids: string[]) =>
    void confirm
      .destructive({
        title: `Disband ${ids.length} ${ids.length === 1 ? "group" : "groups"}?`,
        description:
          "The groups are removed and their items go back to the library. The items are kept.",
        confirmText: "Disband",
      })
      .then(async (ok) => {
        if (!ok) return;
        let failed = false;
        // One after another: the server serializes group changes anyway
        for (const id of ids)
          if ((await run(orpc.groups.disband.call({ id }))) === undefined) {
            failed = true;
            break;
          }
        if (!failed) toast("Groups disbanded");
        stopSelecting();
        changed();
      });

  const startDelete = (ids: string[]) => {
    setDeleteQueue(ids);
    setDeleteTotal(ids.length);
  };
  const deleting = groups?.[deleteQueue[0] ?? ""] ?? null;
  const editing = groups?.[editId ?? ""] ?? null;
  const confirmDisband = (g: GroupType) =>
    void confirm
      .destructive({
        title: "Disband this group?",
        description: `"${g.title || g.id}" is removed and its ${counts[g.id] ?? 0} ${(counts[g.id] ?? 0) === 1 ? "item goes" : "items go"} back to the library. The items are kept.`,
        confirmText: "Disband",
      })
      .then((ok) => {
        if (ok) void disband(g.id);
      });

  return (
    <>
      {!!tags && (
        <>
          <GroupEditModal
            group={editing}
            onClose={() => setEditId(null)}
            onSaved={() => {
              stopSelecting(); // an id change would leave a stale selection
              changed();
            }}
          />
          <NewGroupModal
            open={newOpen}
            onClose={() => setNewOpen(false)}
            onCreated={changed}
          />
          <MergeGroupsModal
            groups={
              mergeIds
                ? selectedGroups.filter((g) => mergeIds.includes(g.id))
                : null
            }
            counts={counts}
            onClose={() => setMergeIds(null)}
            onDone={(ok) => {
              setMergeIds(null);
              if (ok) stopSelecting();
              changed();
            }}
          />
          <DeleteGroupModal
            group={deleting}
            groups={groups ?? {}}
            step={
              deleteTotal > 1
                ? `Group ${deleteTotal - deleteQueue.length + 1} of ${deleteTotal}`
                : undefined
            }
            onClose={() => {
              setDeleteQueue([]);
              changed();
            }}
            onDone={(ok) => {
              changed();
              // Next group of the batch; a failure stops it
              if (ok) setDeleteQueue((q) => q.slice(1));
              else setDeleteQueue([]);
              if (ok && deleteQueue.length <= 1) stopSelecting();
            }}
          />
        </>
      )}
      <TitleHeader
        Title="Groups"
        description="Every group, including empty ones. A group keeps related items together; its items leave the main library unless tagged view:in-library."
      >
        {!!tags && (
          <>
            <Button
              size="sm"
              onClick={() => setNewOpen(true)}
              title="Create an empty group"
            >
              <Plus />
              New group
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fix()}
              title="Recreate missing group records for ids found on items, and clear empty cover strings"
            >
              <Wrench />
              Fix Data
            </Button>
            <Button
              size="sm"
              variant={selectionOn ? "default" : "outline"}
              aria-pressed={selectionOn}
              onClick={() =>
                selectionOn ? stopSelecting() : setSelectionOn(true)
              }
              title="Pick several groups to merge, disband or delete them together"
            >
              {selectionOn ? (
                <>
                  <X /> Done selecting
                </>
              ) : (
                <>
                  <CheckSquare /> Select groups
                </>
              )}
            </Button>
          </>
        )}
      </TitleHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-2">
        <Input
          aria-label="Search groups"
          placeholder="Search groups by title or id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {selectionOn ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {selected.length}
              </span>{" "}
              of <span className="tabular-nums">{list.length}</span> selected
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {list.length}
              </span>{" "}
              {list.length === 1 ? "group" : "groups"}
              {list.length !== total && ` of ${total}`}
            </>
          )}
        </p>
        {!!tags && selectionOn && (
          <>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={list.length > 0 && selected.length === list.length}
                onCheckedChange={(on) =>
                  setSelected(on ? list.map((g) => g.id) : [])
                }
              />
              Select all
            </Label>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length < 2}
              onClick={() => setMergeIds(selected)}
              title={
                selected.length < 2
                  ? "Select at least two groups"
                  : "Merge the selected groups into one"
              }
            >
              <Merge />
              Merge
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => disbandMany(selected)}
              title="Remove the selected groups and keep their items"
            >
              <Unlink />
              Disband
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected.length}
              onClick={() => startDelete(selected)}
              title="Delete the selected groups and their items"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
              Delete
            </Button>
          </>
        )}
      </div>

      {groupsQ.isError || contentQ.isError ? (
        <ErrorState
          title="Couldn't load the groups"
          message={(groupsQ.error ?? contentQ.error)?.message}
          onRetry={() => {
            void groupsQ.refetch();
            void contentQ.refetch();
          }}
        />
      ) : !groups || !contentQ.data ? (
        <LoadingState label="Loading the groups…" />
      ) : list.length === 0 ? (
        total > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No groups match this search"
            description="Try a shorter search."
          >
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="There are no groups yet"
            description="Use “New group” to create one, then add items with “Add to group…” in the library’s selection bar or an item’s edit dialog."
          />
        )
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {list.map((g) => {
            const kids = children[g.id] ?? NO_ITEMS;
            const name = g.title || g.id;
            return (
              <GroupCard
                key={g.id}
                group={g}
                count={kids.length}
                cover={g.cover || null}
                childTags={childTags[g.id]}
                selection={
                  tags
                    ? {
                        on: selectionOn,
                        selected: selected.includes(g.id),
                        onToggle: () => toggle(g.id),
                      }
                    : undefined
                }
                actions={
                  tags ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Edit the title, tags, cover, description and id"
                        aria-label={`Edit ${name}`}
                        onClick={() => setEditId(g.id)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Fix Data for this group: clear an empty cover string"
                        aria-label={`Fix data of ${name}`}
                        onClick={() => void fix(g.id)}
                      >
                        <Wrench />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Remove the group and keep its items"
                        aria-label={`Disband ${name}`}
                        onClick={() => confirmDisband(g)}
                      >
                        <Unlink />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Delete the group and its items from the server"
                        aria-label={`Delete ${name}`}
                        onClick={() => startDelete([g.id])}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
