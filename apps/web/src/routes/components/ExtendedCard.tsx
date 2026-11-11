import { getCoverUrl } from "@tagapp/utils";
import type { ContentServerType } from "@tagapp/utils/types";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useMemo, useState } from "react";
import { tagsAtom } from "@/atom";
import { confirm } from "@/components/craft/confirm-dialog";
import ContentCard from "@/components/craft/library/ContentCard";
import {
  updateExtraDataAtom,
  updateGroupsAtom,
  updateIdAtom,
  updateModalOpenAtom,
  updateTagsAtom,
  updateTitleAtom,
} from "@/components/craft/UpdateModal/atom";
import { selectEntryAtom, selectionOnAtom } from "../atom.selection";
import { useServerActions } from "../contexts/Server.Context";

const getUrl = (id: string, Type: string) => `#/${Type}/${id}`;

/** `onPickCover` is set only while `/group/:id` is choosing a cover. */
const ExtendedCard = memo(
  ({
    Content,
    onPickCover,
  }: {
    Content: ContentServerType;
    onPickCover?: (item: ContentServerType) => void;
  }) => {
    const { removeContents, isSelected } = useServerActions();

    const tags = useAtomValue(tagsAtom);

    const setUpdateModalOpen = useSetAtom(updateModalOpenAtom);
    const setUpdateId = useSetAtom(updateIdAtom);

    const setTitle = useSetAtom(updateTitleAtom);
    const setExtraData = useSetAtom(updateExtraDataAtom);
    const setUpdateTags = useSetAtom(updateTagsAtom);
    const setUpdateGroups = useSetAtom(updateGroupsAtom);

    const selectionOn = useAtomValue(selectionOnAtom);
    const selectEntry = useSetAtom(selectEntryAtom);

    const updateSetupFunc = useCallback(() => {
      setTitle(Content.title);
      setUpdateTags(Content.tags.map((o: string) => ({ label: o, value: o })));
      setExtraData(Content.extraData);
      setUpdateGroups(Content.groups ?? []);
      setUpdateId(Content.id);
      setUpdateModalOpen(true);
    }, [
      Content,
      setUpdateModalOpen,
      setUpdateTags,
      setUpdateGroups,
      setUpdateId,
      setTitle,
      setExtraData,
    ]);

    const removeContent = useCallback(() => {
      void confirm
        .destructive({
          title: "Remove this item?",
          description: `"${Content.title}" and its files will be deleted from the server. This can't be undone.`,
          confirmText: "Remove",
        })
        .then((ok) => {
          if (ok) removeContents([Content.id]);
        });
    }, [Content.id, Content.title, removeContents]);

    const Selected = useMemo(
      () => isSelected(Content.id),
      [isSelected, Content.id],
    );

    // Videos may have no cover file, and only the request can tell (the DB doesn't record it)
    const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
    const fullCoverUrl = useMemo(() => getCoverUrl(Content), [Content]);
    const coverUrl = fullCoverUrl !== failedCoverUrl ? fullCoverUrl : null;

    return (
      <ContentCard
        content={Content}
        url={getUrl(Content.id, Content.type)}
        cover={coverUrl ? `/${coverUrl}` : null}
        onCoverError={() => setFailedCoverUrl(fullCoverUrl)}
        selection={{
          on: selectionOn,
          selected: Selected,
          onToggle: () => selectEntry(Content.id),
        }}
        onPickCover={onPickCover && (() => onPickCover(Content))}
        onEdit={tags ? updateSetupFunc : undefined}
        onRemove={tags ? removeContent : undefined}
      />
    );
  },
);

export default ExtendedCard;
