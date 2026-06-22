import CodeEditor from "@uiw/react-textarea-code-editor";
import { useAtom } from "jotai";
import { updateTxtAtom, updateTxtModalOpenAtom } from "./atom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export default function UpdateTxtModal({
  updateFunc,
}: {
  updateFunc: (content: string) => void;
}) {
  const [txt, setTxt] = useAtom(updateTxtAtom);
  const [modalOpen, setModalOpen] = useAtom(updateTxtModalOpenAtom);
  const { theme } = useTheme();

  if (!modalOpen) return <></>;

  return (
    <div
      style={{ zIndex: 2147483647 }}
      className="grid fixed min-h-screen top-0 right-0 w-full place-items-center overflow-y-auto overflow-x-clip"
    >
      <div
        onClick={() => setModalOpen(false)}
        className="h-screen absolute w-full bg-black/10 backdrop-blur-xs"
      />
      <div className="max-w-3xl absolute w-full grid bg-secondary rounded shadow px-8 py-10">
        <div className="max-h-[max(80vh,20rem)] h-full overflow-y-scroll mb-4">
          <CodeEditor
            value={txt}
            language="md"
            placeholder="Extra data."
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
        <Button
          onClick={() => updateFunc(txt)}
          className="max-w-sm w-11/12 mx-auto"
        >
          Update
        </Button>
      </div>
    </div>
  );
}
