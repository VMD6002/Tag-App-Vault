import { useCallback, useState } from "react";
import { z } from "zod";
import { useAtomValue } from "jotai";
import saveJsonFile from "@/lib/saveJsonFile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultipleSelector from "@/components/ui/multiple-selector";
import CodeEditor from "@uiw/react-textarea-code-editor";
import { customAlphabet } from "nanoid";
import TitleHeader from "@/components/craft/TitleHeader";
import { tagsAtom } from "@/atom";
import { useTheme } from "@/components/theme-provider";

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

export const ContentJsonSchema = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  extraData: z.string(),
  // Unix Timestamps
  added: z.number(),
  lastUpdated: z.number(),
});

export default function GenerateJSONPage() {
  const globalTags = useAtomValue(tagsAtom);

  if (!globalTags) return <p>Loading...</p>;

  const { theme } = useTheme();

  const [id, setId] = useState("gen_" + nanoid());
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
      alert("Please check your inputs, validation failed.");
    }
  };

  const generateAndSetUniqueIdFromTitle = useCallback(() => {
    const id = "gen_title_" + getUniqueIdFromString(title);
    setId(id);
  }, [title]);

  const generateRandomId = useCallback(() => {
    const id = "gen_" + nanoid();
    setId(id);
  }, []);

  return (
    <>
      <TitleHeader Title="Generate JSON" />
      <div className="max-w-md w-full mx-auto grid p-4">
        <div className="flex justify-between mb-2 items-center">
          <Label>Name</Label>
          <div className="flex">
            <Button
              className="rounded-r-none"
              size="xs"
              onClick={generateRandomId}
              variant="outline"
            >
              Random
            </Button>
            <Button
              className="rounded-l-none"
              size="xs"
              onClick={generateAndSetUniqueIdFromTitle}
              variant="outline"
            >
              ID from Title
            </Button>
          </div>
        </div>
        <Input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID"
          className="mb-4"
        />

        <Label className="mb-2">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="mb-4"
        />

        <Label className="mb-2">Tags</Label>
        <MultipleSelector
          options={Object.keys(globalTags).map((o) => ({
            label: o,
            value: o,
          }))}
          className="mb-4"
          placeholder="Tags"
          value={tags}
          onChange={setTags}
        />

        <Label className="mb-2">Extra Data</Label>
        <div className="max-h-36 overflow-y-scroll bg-input/90 mb-4">
          <CodeEditor
            value={extraData}
            language="md"
            placeholder="Extra data."
            onChange={(evn) => setExtraData(evn.target.value)}
            padding={15}
            className="bg-background/80!"
            style={{
              fontFamily:
                "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
            }}
            data-color-mode={theme === "system" ? "dark" : theme}
          />
        </div>

        <Button
          onClick={handleSaveJson}
          className="max-w-sm w-11/12 mx-auto mt-4"
        >
          Save
        </Button>
      </div>
    </>
  );
}
