import { ContentJsonSchema } from "@tagapp/utils/types";
import CodeEditor from "@uiw/react-textarea-code-editor";
import { useAtomValue } from "jotai";
import { customAlphabet } from "nanoid";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { tagsAtom } from "@/atom";
import { LoadingState } from "@/components/craft/EmptyState";
import MultiSelect from "@/components/craft/MultiSelect";
import TitleHeader from "@/components/craft/TitleHeader";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import saveJsonFile from "@/lib/saveJsonFile";

const capitalLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const smallLetter = "abcdefghijklmnopqrstuvwxyz";
const number = "1234567890";
const nanoid = customAlphabet(`${smallLetter}${number}${capitalLetter}`, 10);

function getUniqueIdFromString(str: string): string {
  // Constants for FNV-1a 32-bit
  const FNV_PRIME_32 = 0x01000193; // 16777619
  const FNV_OFFSET_32 = 0x811c9dc5; // 2166136261

  // Normalize to handle identical characters with different Unicode encodings
  const cleanStr = str.normalize("NFC");

  let hash = FNV_OFFSET_32;

  for (let i = 0; i < cleanStr.length; i++) {
    // XOR the bottom 8 bits of the character code
    hash ^= cleanStr.charCodeAt(i);

    // Use Math.imul to perform 32-bit integer multiplication
    hash = Math.imul(hash, FNV_PRIME_32);
  }

  // >>> 0 converts the signed integer to an unsigned 32-bit integer
  // .toString(36) creates a compact alphanumeric string (0-9, a-z)
  return (hash >>> 0).toString(36);
}

export default function GenerateJSONPage() {
  const globalTags = useAtomValue(tagsAtom);
  const { theme } = useTheme();

  const [id, setId] = useState(`gen_${nanoid()}`);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<any[]>([]);
  const [extraData, setExtraData] = useState("");

  const handleSaveJson = () => {
    const time = Math.floor(Date.now() / 1000);
    try {
      const parsedData = ContentJsonSchema.parse({
        id,
        title,
        tags: tags.map((t) => t.value),
        extraData,
        added: time,
        lastUpdated: time,
      });
      saveJsonFile(parsedData, `${parsedData.title}.${parsedData.id}`);
    } catch (error) {
      console.error("Validation Error:", error);
      toast.error("Please check your inputs, validation failed.");
    }
  };

  const generateAndSetUniqueIdFromTitle = useCallback(() => {
    const id = `gen_title_${getUniqueIdFromString(title)}`;
    setId(id);
  }, [title]);

  const generateRandomId = useCallback(() => {
    const id = `gen_${nanoid()}`;
    setId(id);
  }, []);

  if (!globalTags)
    return (
      <>
        <TitleHeader
          Title="Generate JSON"
          description="Make a metadata file for an item you add to the server's Sync folder by hand."
        />
        <LoadingState
          label="Waiting for tags from the TagApp browser extension…"
          hint="This page suggests tags from your library, and they come from the extension. If nothing happens, check that the extension is installed and connected to this server."
        />
      </>
    );

  return (
    <>
      <TitleHeader
        Title="Generate JSON"
        description="Make a metadata file for an item you add to the server's Sync folder by hand. Put the downloaded file in that folder, next to the item it describes."
      />
      <div className="mx-auto grid w-full max-w-md gap-5 pb-4">
        <div className="grid gap-2">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <Label htmlFor="gen-id">ID</Label>
            <div className="flex">
              <Button
                className="rounded-r-none"
                size="xs"
                onClick={generateRandomId}
                variant="outline"
                title="Use a new random ID"
              >
                Random
              </Button>
              <Button
                className="rounded-l-none"
                size="xs"
                onClick={generateAndSetUniqueIdFromTitle}
                variant="outline"
                title="Make the ID from the title, so the same title always gives the same ID"
              >
                From title
              </Button>
            </div>
          </div>
          <Input
            id="gen-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ID"
            className="font-mono"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="gen-title">Title</Label>
          <Input
            id="gen-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
        </div>

        <div className="grid gap-2">
          <Label>Tags</Label>
          <MultiSelect
            options={globalTags.map((o) => ({
              label: o,
              value: o,
            }))}
            placeholder="Choose tags"
            label="Tags"
            value={tags}
            onChange={setTags}
          />
        </div>

        <div className="grid gap-2">
          <Label>Notes</Label>
          <div className="max-h-40 overflow-y-auto border border-input">
            <CodeEditor
              value={extraData}
              language="md"
              placeholder="Notes (markdown)"
              onChange={(evn) => setExtraData(evn.target.value)}
              padding={12}
              className="bg-background/80!"
              style={{
                fontFamily:
                  "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
              }}
              data-color-mode={theme === "system" ? "dark" : theme}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSaveJson}
            title="Download the JSON file. Nothing is sent to the server."
          >
            Download JSON file
          </Button>
          <span className="text-xs text-muted-foreground">
            Saved as <span className="font-mono">title.id.json</span>
          </span>
        </div>
      </div>
    </>
  );
}
