import CodeEditor from "@uiw/react-textarea-code-editor";
import { useAtom, useAtomValue } from "jotai";
import { Redo2 } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { tagsAtom } from "@/atom";
import ModalShell from "@/components/craft/ModalShell";
import MultiSelect from "@/components/craft/MultiSelect";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateContentUrlAtom,
  updateCoverAtom,
  updateExistsAtom,
  updateExtraDataAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateResetOptionsAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "./atom";
import SeeMore from "./SeeMore";

/** Label row with the optional "reset to the original value" button. */
function Field({
  label,
  htmlFor,
  onReset,
  children,
}: {
  label: string;
  htmlFor?: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex min-h-6 items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {onReset && (
          <Button
            onClick={onReset}
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label.toLowerCase()}`}
            title="Reset to the original value"
          >
            <Redo2 />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export default function UpdateModal({
  className = "",
  updateContentFunc,
  extra,
}: {
  updateContentFunc: () => void;
  className?: string;
  /** Extra fields under Tags (the library's groups section). */
  extra?: ReactNode;
}) {
  const tags = useAtomValue(tagsAtom);
  const { theme } = useTheme();
  const [modalOpen, setModalOpen] = useAtom(updateModalOpenAtom);
  const [title, setTitle] = useAtom(updateTitleAtom);
  const [extraData, setExtraData] = useAtom(updateExtraDataAtom);
  const [updateTags, setUpdateTags] = useAtom(updateTagsAtom);
  const [cover, setCover] = useAtom(updateCoverAtom);
  const [contentUrl, setContentUrl] = useAtom(updateContentUrlAtom);
  const isDisabled = useAtomValue(updateInputDisabledAtom);
  const exists = useAtomValue(updateExistsAtom);
  const resetFuntions = useAtomValue(updateResetOptionsAtom);
  const {
    title: resetTitle,
    tags: resetTags,
    cover: resetCover,
    contentUrl: resetContentUrl,
    extraData: resetExtraData,
  } = resetFuntions ?? {};
  const close = useCallback(() => setModalOpen(false), [setModalOpen]);

  return (
    <ModalShell
      open={modalOpen}
      onClose={close}
      title={exists ? "Edit item" : "Add to library"}
      description="Renaming also renames the item's files on the server."
      className={className}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={isDisabled} onClick={updateContentFunc}>
            {isDisabled
              ? "Saving…"
              : exists
                ? "Save changes"
                : "Add to library"}
          </Button>
        </>
      }
    >
      <Field
        label="Title"
        htmlFor="update-title"
        onReset={resetTitle ? () => setTitle(resetTitle()) : undefined}
      >
        <Input
          id="update-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
      </Field>
      <Field
        label="Tags"
        onReset={resetTags ? () => setUpdateTags(resetTags()) : undefined}
      >
        <MultiSelect
          options={(tags ?? []).map((o) => ({
            label: o,
            value: o,
          }))}
          placeholder="Choose tags"
          label="Tags"
          value={updateTags}
          onChange={setUpdateTags}
        />
      </Field>
      {extra}
      <SeeMore>
        {cover && (
          <Field
            label="Cover"
            htmlFor="update-cover"
            onReset={resetCover ? () => setCover(resetCover()) : undefined}
          >
            <Input
              id="update-cover"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="Cover image"
            />
          </Field>
        )}
        {contentUrl && (
          <Field
            label="Content URL"
            htmlFor="update-content-url"
            onReset={
              resetContentUrl
                ? () => setContentUrl(resetContentUrl())
                : undefined
            }
          >
            <Input
              id="update-content-url"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="Content URL"
            />
          </Field>
        )}
        <Field
          label="Notes"
          onReset={
            resetExtraData ? () => setExtraData(resetExtraData()) : undefined
          }
        >
          <div className="max-h-40 overflow-y-auto border border-input">
            <CodeEditor
              value={extraData}
              language="md"
              placeholder="Notes (markdown)"
              onChange={(evn) => setExtraData(evn.target.value)}
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
      </SeeMore>
    </ModalShell>
  );
}
