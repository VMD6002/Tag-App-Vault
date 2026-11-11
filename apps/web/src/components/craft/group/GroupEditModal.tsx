import { VIEW_HIDE_IN_LIBRARY_TAG } from "@tagapp/utils";
import type { GroupType } from "@tagapp/utils/types";
import CodeEditor from "@uiw/react-textarea-code-editor";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { type MultiSelectOption, tagsAtom } from "@/atom";
import ModalShell from "@/components/craft/ModalShell";
import MultiSelect from "@/components/craft/MultiSelect";
import Field from "@/components/craft/UpdateModal/Field";
import SeeMore from "@/components/craft/UpdateModal/SeeMore";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { run } from "@/hooks/useGroupActions";
import { orpc } from "@/lib/orpc";

/**
 * Edit a group like the item edit modal: title and the group's OWN tags up top; cover URL (empty
 * clears it: no cover), description (markdown) and id under
 * "More fields". Changing the id rewrites it on every item; an id that already exists merges this
 * group into it.
 */
export default function GroupEditModal({
  group,
  onClose,
  onSaved,
}: {
  /** Mount with `null` while closed. */
  group: GroupType | null;
  onClose: () => void;
  /** Runs after a save with the group's final id (it changes with the id). */
  onSaved: (id: string) => void;
}) {
  const { theme } = useTheme();
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
      <Field label="Title" htmlFor="group-title">
        <Input
          id="group-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Tags">
        <MultiSelect
          options={options}
          placeholder="Choose tags"
          label="Group tags"
          value={picked}
          onChange={setPicked}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Switch
          id="group-hide-in-library"
          checked={picked.some((t) => t.value === VIEW_HIDE_IN_LIBRARY_TAG)}
          onCheckedChange={(on) =>
            setPicked((old) =>
              on
                ? [
                    ...old,
                    {
                      label: VIEW_HIDE_IN_LIBRARY_TAG,
                      value: VIEW_HIDE_IN_LIBRARY_TAG,
                    },
                  ]
                : old.filter((t) => t.value !== VIEW_HIDE_IN_LIBRARY_TAG),
            )
          }
        />
        <Label htmlFor="group-hide-in-library" className="text-sm">
          Hide from the main library
        </Label>
      </div>
      <SeeMore>
        <Field label="Cover URL" htmlFor="group-cover">
          <Input
            id="group-cover"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="Empty: no cover"
          />
        </Field>
        <Field label="Description">
          <div className="max-h-40 overflow-y-auto border border-input">
            <CodeEditor
              value={extraData}
              language="md"
              placeholder="Description (markdown)"
              onChange={(e) => setExtraData(e.target.value)}
              padding={12}
              className="bg-background/80"
              style={{
                fontFamily:
                  "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
              }}
              data-color-mode={theme === "system" ? "dark" : theme}
            />
          </div>
        </Field>
        <Field label="Id" htmlFor="group-id">
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
        </Field>
      </SeeMore>
    </ModalShell>
  );
}
