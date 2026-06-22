import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultipleSelector from "@/components/ui/multiple-selector";
import CodeEditor from "@uiw/react-textarea-code-editor";
import SeeMore from "./SeeMore";
import { useAtom, useAtomValue } from "jotai";
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
import { Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { tagsAtom } from "@/atom";

export default function UpdateModal({
  className = "",
  updateContentFunc,
}: {
  updateContentFunc: () => void;
  className?: string;
}) {
  const tags = useAtomValue(tagsAtom)!;
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
      <div
        className={cn(
          "max-w-md absolute w-full grid bg-secondary rounded shadow px-8 py-10",
          className,
        )}
      >
        <div className="flex justify-between mb-2 items-center">
          <Label>Name</Label>
          {resetFuntions?.title && (
            <Button
              onClick={() => setTitle(resetFuntions.title!())}
              size="icon"
              variant="outline"
              className="scale-80"
            >
              <Redo2 />
            </Button>
          )}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name"
          className="mb-4"
        />
        <div className="flex justify-between mb-2 items-center">
          <Label>Tags</Label>
          {resetFuntions?.tags && (
            <Button
              onClick={() => setUpdateTags(resetFuntions.tags!())}
              size="icon"
              variant="outline"
              className="scale-80"
            >
              <Redo2 />
            </Button>
          )}
        </div>
        <MultipleSelector
          options={Object.keys(tags).map((o) => ({
            label: o,
            value: o,
          }))}
          className="mb-4"
          placeholder="Tags"
          value={updateTags}
          onChange={setUpdateTags}
        />
        <SeeMore>
          {cover && (
            <>
              <div className="flex justify-between mb-2 items-center">
                <Label>Cover</Label>
                {resetFuntions?.cover && (
                  <Button
                    onClick={() => setCover(resetFuntions.cover!())}
                    size="icon"
                    variant="outline"
                    className="scale-80"
                  >
                    <Redo2 />
                  </Button>
                )}
              </div>
              <Input
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="Name"
                className="mb-4"
              />
            </>
          )}
          {contentUrl && (
            <>
              <div className="flex justify-between mb-2 items-center">
                <Label>Content Url</Label>
                {resetFuntions?.contentUrl && (
                  <Button
                    onClick={() => setContentUrl(resetFuntions.contentUrl!())}
                    size="icon"
                    variant="outline"
                    className="scale-80"
                  >
                    <Redo2 />
                  </Button>
                )}
              </div>
              <Input
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="Content Url"
                className="mb-4"
              />
            </>
          )}
          {extraData && (
            <div className="flex justify-between mb-2 items-center">
              <Label>Extra Data</Label>
              {resetFuntions?.extraData && (
                <Button
                  onClick={() => setExtraData(resetFuntions.extraData!())}
                  size="icon"
                  variant="outline"
                  className="scale-80"
                >
                  <Redo2 />
                </Button>
              )}
            </div>
          )}
          <div className="max-h-36 overflow-y-scroll mb-4">
            <CodeEditor
              value={extraData}
              language="md"
              placeholder="Extra data."
              onChange={(evn) => setExtraData(evn.target.value)}
              padding={15}
              className="bg-background/80"
              style={{
                fontFamily:
                  "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
              }}
              data-color-mode={theme === "system" ? "dark" : theme}
            />
          </div>
        </SeeMore>
        <Button
          disabled={isDisabled}
          onClick={updateContentFunc}
          className="max-w-sm w-11/12 mx-auto"
        >
          {exists ? "Update" : "Add"}
        </Button>
      </div>
    </div>
  );
}
