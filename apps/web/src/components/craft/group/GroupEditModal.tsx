import type { ContentServerType, GroupType } from "@tagapp/utils/types";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { type MultiSelectOption, tagsAtom } from "@/atom";
import ModalShell from "@/components/craft/ModalShell";
import MultiSelect from "@/components/craft/MultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/hooks/useGroupActions";
import { getCoverUrl } from "@/lib/coverUrl";
import { orpc } from "@/lib/orpc";

const MAX_COVER_PICKS = 12;

/**
 * Edit a group: title, tags, cover (the children's covers as quick picks, or any URL; empty clears
 * it and the card falls back to a child's cover), description (markdown) and id. Changing the id
 * rewrites it on every item; an id that already exists merges this group into it.
 */
export default function GroupEditModal({
  group,
  items,
  onClose,
  onSaved,
}: {
  /** Mount with `null` while closed. */
  group: GroupType | null;
  /** The group's children (cover quick picks). */
  items: ContentServerType[];
  onClose: () => void;
  /** Runs after a save with the group's final id (it changes with the id). */
  onSaved: (id: string) => void;
}) {
  const extensionTags = useAtomValue(tagsAtom);
  const [title, setTitle] = useState("");
  const [extraData, setExtraData] = useState("");
  const [picked, setPicked] = useState<MultiSelectOption[]>([]);
  const [cover, setCover] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);

  // Reload the form each time the dialog opens (or switches group), not on every data refresh
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the group id only
  useEffect(() => {
    if (!group) return;
    setTitle(group.title);
    setExtraData(group.extraData);
    setPicked(group.tags.map((t) => ({ label: t, value: t })));
    setCover(group.cover ?? "");
    setId(group.id);
  }, [group?.id]);

  const options = useMemo(
    () =>
      [...new Set([...(extensionTags ?? []), ...(group?.tags ?? [])])]
        .sort()
        .map((t) => ({ label: t, value: t })),
    [extensionTags, group?.tags],
  );
  // Stored covers are plain URLs, so a child's cover is saved with its leading slash
  const coverPicks = useMemo(
    () => [
      ...new Set(
        items.flatMap((c) => getCoverUrl(c) ?? []).map((u) => `/${u}`),
      ),
    ],
    [items],
  );

  const save = async () => {
    if (!group) return;
    const newId = id.trim() || group.id;
    setBusy(true);
    try {
      const updated = await run(
        orpc.groups.update.call({
          id: group.id,
          title,
          extraData,
          tags: picked.map((o) => o.value),
          cover: cover.trim(), // "" clears it
        }),
      );
      const done =
        updated && newId !== group.id
          ? await run(orpc.groups.changeId.call({ oldId: group.id, newId }))
          : updated;
      // A failed id change still saved the rest, so the page reloads either way
      if (updated) onSaved(done ? newId : group.id);
      if (done) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={!!group}
      onClose={onClose}
      title="Edit group"
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !title.trim()} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="group-title">Title</Label>
        <Input
          id="group-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Tags</Label>
        <MultiSelect
          options={options}
          placeholder="Choose tags"
          label="Group tags"
          value={picked}
          onChange={setPicked}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-cover">Cover URL</Label>
        <Input
          id="group-cover"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          placeholder="Empty: use one of the items' covers"
        />
        {coverPicks.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Item covers">
            {coverPicks.slice(0, MAX_COVER_PICKS).map((url) => (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => setCover(url)}
                  title="Use this cover"
                  className={
                    url === cover
                      ? "block border border-foreground ring-1 ring-foreground"
                      : "block border hover:border-foreground/50"
                  }
                >
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="size-14 object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-description">Description</Label>
        <Textarea
          id="group-description"
          value={extraData}
          onChange={(e) => setExtraData(e.target.value)}
          placeholder="Description (markdown)"
          className="max-h-48 min-h-24 font-mono text-xs"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="group-id">Id</Label>
        <Input
          id="group-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Changing the id rewrites it on every item in the group. If a group
          with the new id exists, this group merges into it.
        </p>
      </div>
    </ModalShell>
  );
}
