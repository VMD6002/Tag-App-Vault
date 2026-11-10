import { sanitizeStringForFileName } from "@tagapp/utils";
import type { ContentServerType } from "@tagapp/utils/types";
import { useMutation } from "@tanstack/react-query";
import constate from "constate";
import { useAtomValue, useSetAtom } from "jotai";
import { FileQuestion } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { tagsAtom } from "@/atom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/craft/EmptyState";
import UpdateModal from "@/components/craft/UpdateModal";
import {
  updateDataAtom,
  updateExtraDataAtom,
  updateIdAtom,
  updateInputDisabledAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

const docPlaceholderData: ContentServerType = {
  id: "",
  title: "",
  cover: "",
  tags: [],
  added: 0, // Unix epoch start time
  lastUpdated: 0, // Unix epoch start time
  extraData: "",
  type: "img",
};

function useDocContext() {
  const tags = useAtomValue(tagsAtom);

  const { id } = useRoute("/:contentType/:id")[1] as { id: string };
  const [, navigate] = useLocation();
  const [doc, setDoc] = useState<ContentServerType>(docPlaceholderData);
  const setInputDisabled = useSetAtom(updateInputDisabledAtom);

  const setTitle = useSetAtom(updateTitleAtom);
  const setExtraData = useSetAtom(updateExtraDataAtom);
  const setUpdateTags = useSetAtom(updateTagsAtom);
  const setId = useSetAtom(updateIdAtom);

  const getContentMutation = useMutation(
    orpc.main.getContent.mutationOptions({
      onSuccess: (res) => {
        setId(res.id);
        setTitle(res.title);
        setExtraData(res.extraData);
        setUpdateTags(res.tags.map((tag) => ({ label: tag, value: tag })));
        setDoc(res);
      },
      onError: () => {
        console.error("Couldn't get doc, check console for errors");
      },
    }),
  );

  const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
  const updateContentModified = useMutation(
    orpc.main.setContent.mutationOptions({
      onSuccess: (res) => {
        setDoc(res);
        setTitle(res.title);
        setUpdateModalOpen(false);
        setInputDisabled(false);
      },
      onError: () => {
        toast.error("Couldn't update, check console for error");
        setInputDisabled(false);
      },
    }),
  );

  const updateData = useAtomValue(updateDataAtom);
  const updateContentFunc = useCallback(() => {
    const sanitizedTitle = sanitizeStringForFileName(updateData.title);
    if (!sanitizedTitle) {
      toast.warning("Title must not be blank");
      setTitle("");
      return;
    }
    const content: typeof updateData = {
      ...updateData,
      title: sanitizedTitle,
    };
    setInputDisabled(true);
    updateContentModified.mutate(content);
  }, [updateData, setTitle, updateContentModified.mutate, setInputDisabled]);

  const removeContentsMutaion = useMutation(
    orpc.main.removeContents.mutationOptions({
      onSuccess: () => {
        navigate("/");
      },
      onError: () => {
        toast.error("delete contents failed, check console for error");
      },
    }),
  );
  const removeContent = useCallback(() => {
    removeContentsMutaion.mutate([id]);
  }, [id, removeContentsMutaion.mutate]);

  const encodedTitle = useMemo(
    () => encodeURIComponent(`${doc.title}.${doc.id}`),
    [doc.title, doc.id],
  );

  const setCoverMutation = useMutation(
    orpc.main.setCover.mutationOptions({
      onSuccess: (data) => {
        setDoc((old) => ({ ...old, cover: data.coverPath }));
      },
    }),
  );

  return {
    tags,
    doc,
    orpc,
    encodedTitle,
    getContentMutation,
    setDoc,
    removeContent,
    setCoverMutation,
    updateContentFunc,
  };
}

export const [Provider, useDoc] = constate(useDocContext);

export function Child({ children }: { children: React.ReactNode }) {
  const { doc, getContentMutation, updateContentFunc } = useDoc();
  const { id } = useRoute("/:contentType/:id")[1] as { id: string };

  useEffect(() => {
    getContentMutation.mutate({ id });
  }, [id, getContentMutation.mutate]);

  if (getContentMutation.isError) {
    const notFound =
      (getContentMutation.error as { code?: string }).code === "NOT_FOUND";
    return notFound ? (
      <EmptyState
        icon={FileQuestion}
        title="Item not found"
        description="It may have been removed, or the link is wrong."
        className="py-24"
      >
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to library
        </Link>
      </EmptyState>
    ) : (
      <ErrorState
        title="Couldn't load this item"
        message={getContentMutation.error?.message}
        onRetry={() => getContentMutation.mutate({ id })}
      >
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to library
        </Link>
      </ErrorState>
    );
  }

  if (getContentMutation.isPending || !doc.title)
    return <LoadingState label="Loading item…" />;

  return (
    <>
      <UpdateModal updateContentFunc={updateContentFunc} />
      {children}
    </>
  );
}

export default function DocProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <Child>{children}</Child>
    </Provider>
  );
}
