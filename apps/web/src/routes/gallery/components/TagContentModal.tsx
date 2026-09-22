import { useState, useEffect, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { tagModalOpenAtom, tagModalDataAtom, galleryDataAtom } from "./atom";
import { tagsAtom, type MultiSelectOption } from "@/atom";
import { useDoc } from "../../contexts/Doc.Context";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultipleSelector from "@/components/ui/multiple-selector";
import { toast } from "sonner";

function splitFileName(fullName: string) {
  const lastDot = fullName.lastIndexOf(".");
  if (lastDot > 0) {
    return {
      base: fullName.slice(0, lastDot),
      ext: fullName.slice(lastDot),
    };
  }
  return { base: fullName, ext: "" };
}

export default function TagContentModal() {
  const [open, setOpen] = useAtom(tagModalOpenAtom);
  const data = useAtomValue(tagModalDataAtom);
  const setGalleryData = useSetAtom(galleryDataAtom);
  const globalTags = useAtomValue(tagsAtom);
  const { doc, orpc } = useDoc();

  const [baseName, setBaseName] = useState("");
  const [fileExt, setFileExt] = useState("");
  const [nameError, setNameError] = useState("");
  const [selectedTags, setSelectedTags] = useState<MultiSelectOption[]>([]);

  // Format tagsAtom string array into MultipleSelector Option objects
  const tagOptions = useMemo(() => {
    if (!globalTags) return [];
    return globalTags.map((t: string) => ({ label: t, value: t }));
  }, [globalTags]);

  useEffect(() => {
    if (data) {
      const { base, ext } = splitFileName(data.name);
      setBaseName(base);
      setFileExt(ext);
      setNameError("");
      setSelectedTags((data.tags || []).map((t) => ({ label: t, value: t })));
    }
  }, [data]);

  const updateTagsMutation = useMutation(
    orpc.gallery.updateContentTags.mutationOptions({
      onError: (err: any) => {
        toast.error(err?.message || "Failed to update tags");
      },
    }),
  );

  const renameMutation = useMutation(
    orpc.gallery.renameGalleryContent.mutationOptions({
      onError: (err: any) => {
        setNameError(err?.message || "Failed to rename file");
        toast.error(err?.message || "Rename failed");
      },
    }),
  );

  const handleSave = async () => {
    if (!data) return;
    setNameError("");

    const trimmedBase = baseName.trim();
    const originalBase = splitFileName(data.name).base;
    const nameChanged = trimmedBase !== originalBase;

    let targetContentName = data.name;

    if (nameChanged) {
      if (!trimmedBase) {
        setNameError("File name cannot be empty.");
        return;
      }
      const invalidChars = /[\/\\?%*:|"<>]/;
      if (invalidChars.test(trimmedBase)) {
        setNameError("Invalid characters in file name.");
        return;
      }

      try {
        const renameRes = await renameMutation.mutateAsync({
          name: doc.title,
          id: doc.id,
          oldContentName: data.name,
          newBaseName: trimmedBase,
        });
        targetContentName = renameRes.newName;
        setGalleryData(renameRes.galleryData);
      } catch {
        return;
      }
    }

    try {
      const tagsArray = selectedTags.map((t) => t.value);
      const updatedGalleryData = await updateTagsMutation.mutateAsync({
        name: doc.title,
        id: doc.id,
        content: targetContentName,
        tags: tagsArray,
      });

      setGalleryData(updatedGalleryData);
      toast.success("Saved successfully");
      setOpen(false);
    } catch {}
  };

  const isPending = updateTagsMutation.isPending || renameMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Name Field */}
          <div className="space-y-2">
            <Label htmlFor="filename">File Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="filename"
                value={baseName}
                onChange={(e) => {
                  setBaseName(e.target.value);
                  setNameError("");
                }}
                className={nameError ? "border-destructive" : ""}
                placeholder="File name"
              />
              {fileExt && (
                <Badge variant="outline" className="h-9 px-2 text-xs font-mono">
                  {fileExt}
                </Badge>
              )}
            </div>
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Tags Selector */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <MultipleSelector
              value={selectedTags}
              onChange={setSelectedTags}
              options={tagOptions}
              placeholder="Select tags..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
