import { GROUP_ID, SAMPLE_ID, type Scenario } from "./data";

const ALL: Scenario[] = [
  "normal",
  "stress",
  "empty",
  "noresults",
  "loading",
  "error",
];
const ITEM: Scenario[] = ["normal", "stress", "noresults", "loading", "error"];

export type MockPage = {
  slug: string;
  title: string;
  note: string;
  /** Scenarios that make sense for this page. */
  scenarios: Scenario[];
  /** Route to open inside the app for the chosen scenario. */
  path: (scenario: Scenario) => string;
  /** Which RPC routes the loading / error scenarios apply to (default: all). */
  affects?: (route: string) => boolean;
  /** For "no results": the input to type a non-matching query into. */
  search?: string;
  /** Press Enter in that input afterwards (the library applies filters that way). */
  applySearch?: boolean;
};

const item = (type: keyof typeof SAMPLE_ID.normal) => (s: Scenario) =>
  `/${type}/${SAMPLE_ID[s === "stress" ? "stress" : "normal"][type]}`;

/** Gallery / audio / text: loading and error hit the file list, so the page frame and details still render. */
const listOnly = (prefix: string) => (route: string) =>
  route.startsWith(prefix);

export const MOCK_PAGES: MockPage[] = [
  {
    slug: "library",
    title: "Library (/)",
    note: "Real route: filters, results bar, cards, selection, edit / bulk-edit / sync flows. Edit, remove and sync need 'extension connected'.",
    scenarios: ALL,
    path: () => "/",
    search: 'input[aria-label="Search titles"]',
    applySearch: true,
  },
  {
    slug: "groups",
    title: "Groups (/group)",
    note: "Real route: every group incl. the empty one, search, Fix Data, edit, merge, disband and delete (shared items dialog) with 'extension connected'. Fake server, memory only.",
    scenarios: ALL,
    path: () => "/group",
    search: 'input[aria-label="Search groups"]',
  },
  {
    slug: "group",
    title: "Group (/group/:id)",
    note: "Real route: the library page scoped to one group, header actions (edit, Stats, Fix Data, disband, delete), Remove from group and Delete on selection. 'No results' = no item matches; 'empty' = group not found.",
    scenarios: ALL,
    path: (s) => `/group/${s === "stress" ? GROUP_ID.stress : GROUP_ID.normal}`,
    search: 'input[aria-label="Search titles"]',
    applySearch: true,
  },
  {
    slug: "group-empty",
    title: "Empty group (/group/:id)",
    note: "Real route: a group without items.",
    scenarios: ["normal"],
    path: () => `/group/${GROUP_ID.empty}`,
  },
  {
    slug: "sync",
    title: "Sync preview (/sync)",
    note: "Real route: pending items, own filters, edit / remove / Sync (fake server, memory only). Edit, remove and sync need 'extension connected'.",
    scenarios: ALL,
    path: () => "/sync",
    search: 'input[aria-label="Search titles"]',
    applySearch: true,
  },
  {
    slug: "downloads",
    title: "Downloads (/downloads)",
    note: "Real route: queue plus a fake progress stream that replays one run when 'Start downloads' is pressed (needs 'extension connected').",
    scenarios: ["normal", "stress", "empty", "loading", "error"],
    path: () => "/downloads",
  },
  {
    slug: "tags",
    title: "Tags (/tags)",
    note: "Real route: tag search, grouped counts, remove-unused and recount actions.",
    scenarios: ALL,
    path: () => "/tags",
    search: 'input[aria-label="Find a tag"]',
  },
  {
    slug: "reference",
    title: "Reference (/reference)",
    note: "Real route: the Notes markdown rendered in the app.",
    scenarios: ["normal"],
    path: () => "/reference",
  },
  {
    slug: "settings",
    title: "Settings (/settings)",
    note: "Real route: device-local gallery defaults (localStorage); needs no server.",
    scenarios: ["normal"],
    path: () => "/settings",
  },
  {
    slug: "not-found",
    title: "Page not found (404)",
    note: "Real catch-all route.",
    scenarios: ["normal"],
    path: () => "/no-such-page",
  },
  {
    slug: "image",
    title: "Image item (/img/:id)",
    note: "Real route + DocProvider. 'No results' = item not found.",
    scenarios: ITEM,
    path: item("img"),
  },
  {
    slug: "video",
    title: "Video item (/video/:id)",
    note: "Real route. The player has no real video; cover capture can't run.",
    scenarios: ITEM,
    path: item("video"),
  },
  {
    slug: "gallery",
    title: "Gallery item (/gallery/:id)",
    note: "Real route: options bar, cards, modals, floating actions. Loading / error hit the file list.",
    scenarios: ITEM,
    path: item("gallery"),
    affects: listOnly("gallery/"),
  },
  {
    slug: "text",
    title: "Text item (/txt/:id)",
    note: "Real route: chapters, reader, editor modal, media. Loading / error hit the chapter list.",
    scenarios: ITEM,
    path: item("txt"),
    affects: listOnly("text/"),
  },
  {
    slug: "audio",
    title: "Audio item (/audio/:id)",
    note: "Real route: track cards, player, floating actions. The player has no real audio.",
    scenarios: ITEM,
    path: item("audio"),
    affects: listOnly("audio/"),
  },
];
