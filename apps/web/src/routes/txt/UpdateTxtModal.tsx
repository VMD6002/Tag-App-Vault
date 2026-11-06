import CodeEditor from "@uiw/react-textarea-code-editor";
import { useAtom } from "jotai";
import { useCallback } from "react";
import ModalShell from "@/components/craft/ModalShell";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { updateTxtAtom, updateTxtModalOpenAtom } from "./atom";

export default function UpdateTxtModal({
  updateFunc,
  fileName,
  saving = false,
}: {
  updateFunc: (content: string) => void;
  /** Name of the chapter file being edited. */
  fileName: string;
  saving?: boolean;
}) {
  const [txt, setTxt] = useAtom(updateTxtAtom);
  const [modalOpen, setModalOpen] = useAtom(updateTxtModalOpenAtom);
  const { theme } = useTheme();
  const close = useCallback(() => setModalOpen(false), [setModalOpen]);

  return (
    <ModalShell
      open={modalOpen}
      onClose={close}
      title="Edit chapter text"
      description={
        <>
          Editing <span className="[overflow-wrap:anywhere]">{fileName}</span>.
          Markdown is supported. Saving overwrites the file on the server.
        </>
      }
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => updateFunc(txt)}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="max-h-[max(60vh,16rem)] overflow-y-auto border border-input">
        <CodeEditor
          value={txt}
          language="md"
          placeholder="Write markdown here"
          onChange={(evn) => setTxt(evn.target.value)}
          padding={15}
          className="bg-background/80 text-base!"
          style={{
            fontFamily:
              "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
          }}
          data-color-mode={theme === "system" ? "dark" : theme}
        />
      </div>
    </ModalShell>
  );
}
