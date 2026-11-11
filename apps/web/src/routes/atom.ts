import type { LibraryEntry } from "@tagapp/utils";
import type { ContentServerType, GroupsDB } from "@tagapp/utils/types";
import { atom } from "jotai";

/** The whole library, filtered in the browser into `filteredAtom`. */
export const allContentAtom = atom<ContentServerType[]>([]);

/** Every group record (`groups.list`), empty groups included. */
export const allGroupsAtom = atom<GroupsDB>({});

/** Item rows and group cards of the current filter. */
export const filteredAtom = atom<LibraryEntry[]>([]);

export const serverTagsAtom = atom<string[]>([]);

/** The item rows of a result list (group cards are not selectable or editable in bulk). */
export const entryItems = (entries: LibraryEntry[]) =>
  entries.flatMap((e) => (e.kind === "item" ? [e.item] : []));
