// Fake TagAppVault server for the dev-only #/mock pages. A patched `fetch` answers the app's oRPC
// calls (`/rpc/<router>/<procedure>`) and chapter text from memory, and cover/media URLs under
// `/media/` are swapped for generated gradients so no image is ever requested.
import { filterData } from "@tagapp/utils";
import type { ContentServerType } from "@tagapp/utils/types";
import {
  buildDb,
  countTags,
  type MockDb,
  RATIO_BY_ID,
  type Scenario,
} from "./data";

// biome-ignore lint/suspicious/noExplicitAny: each handler declares the input shape of the procedure it stands in for
type Handler = (input: any) => unknown;

type State = {
  scenario: Scenario;
  /** Which RPC routes the loading / error scenarios apply to. */
  affects: (route: string) => boolean;
  db: MockDb;
  tags: Record<string, number>;
};

const state: State = {
  scenario: "normal",
  affects: () => true,
  db: buildDb("normal"),
  tags: {},
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function configureMock(
  scenario: Scenario,
  affects: State["affects"] = () => true,
) {
  state.scenario = scenario;
  state.affects = affects;
  state.db = buildDb(scenario);
  state.tags = {
    ...countTags(state.db),
    ...(scenario === "empty" ? {} : { "Topic:Unused_example": 0 }),
  };
}

const recount = () => {
  const counts = countTags(state.db);
  for (const t of Object.keys(state.tags)) state.tags[t] = counts[t] ?? 0;
  for (const [t, n] of Object.entries(counts)) state.tags[t] = n;
};

class MockError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const notFound = (what: string) =>
  new MockError("NOT_FOUND", 404, `${what} doesn't exist`);

const doc = (id: string) => {
  const c = state.db.contents[id];
  if (!c) throw notFound(`Content with id ${id}`);
  return c;
};

const handlers: Record<string, Handler> = {
  "main/getSettings": () => ({ port: 5001, prefix: "/" }),
  "main/getServerTags": () => state.tags,
  "main/getFilteredData": (i) => filterData(i, state.db.contents),
  "main/getContent": (i: { id: string }) => doc(i.id),
  "main/setContent": (
    i: Pick<ContentServerType, "id" | "title" | "tags" | "extraData">,
  ) => {
    const c = doc(i.id);
    Object.assign(c, i, { lastUpdated: Math.floor(Date.now() / 1000) });
    recount();
    return c;
  },
  "main/setCover": (i: { id: string; coverPath?: string }) => {
    doc(i.id).cover = i.coverPath;
    return i;
  },
  "main/bulkUpdateContentTags": (i: {
    ids: string[];
    added: string[];
    removed: string[];
  }) => {
    for (const id of i.ids) {
      const c = doc(id);
      c.tags = [
        ...new Set([
          ...c.tags.filter((t) => !i.removed.includes(t)),
          ...i.added,
        ]),
      ];
    }
    recount();
    return i;
  },
  "main/removeContents": (i: string[]) => {
    for (const id of i) delete state.db.contents[id];
    recount();
    return i;
  },
  "main/sync": () => state.db.contents,
  "fix/hardResetTagCount": () => {
    state.tags = countTags(state.db);
    return state.tags;
  },
  "fix/softResetTagCount": () => {
    for (const t of Object.keys(state.tags))
      if (!state.tags[t]) delete state.tags[t];
    return state.tags;
  },
  "video/setCoverGivenFile": (i: { id: string; name: string }) => i,

  "gallery/getGalleryData": (i: { id: string }) =>
    state.db.galleries[i.id] ?? [],
  "gallery/refreshGalleryData": (i: { id: string }) =>
    state.db.galleries[i.id] ?? [],
  "gallery/removeGalleryContents": (i: { id: string; contents: string[] }) => {
    const covers = i.contents
      .filter((c) => c.startsWith(".gallery-covers/"))
      .map((c) => c.slice(".gallery-covers/".length));
    const list = (state.db.galleries[i.id] ?? [])
      .filter((e) => !i.contents.includes(e.name))
      .map((e) =>
        e.cover && covers.includes(e.cover) ? { ...e, cover: undefined } : e,
      );
    state.db.galleries[i.id] = list;
    return list;
  },
  "gallery/setCoverGivenFile": (i: { id: string }) =>
    state.db.galleries[i.id] ?? [],
  "gallery/updateContentTags": (i: {
    id: string;
    content: string;
    tags: string[];
  }) => {
    const list = state.db.galleries[i.id] ?? [];
    for (const e of list) if (e.name === i.content) e.tags = i.tags;
    return list;
  },
  "gallery/renameGalleryContent": (i: {
    id: string;
    oldContentName: string;
    newBaseName: string;
  }) => {
    const list = state.db.galleries[i.id] ?? [];
    const ext = i.oldContentName.slice(i.oldContentName.lastIndexOf("."));
    const newName = `${i.newBaseName}${ext}`;
    if (newName !== i.oldContentName && list.some((e) => e.name === newName))
      throw new MockError(
        "CONFLICT",
        409,
        `A file named "${newName}" already exists in this gallery.`,
      );
    for (const e of list) if (e.name === i.oldContentName) e.name = newName;
    return { newName, galleryData: list };
  },

  "audio/getAudioData": (i: { id: string }) => state.db.audios[i.id] ?? [],
  "audio/removeAudioContents": (i: { id: string; contents: string[] }) => {
    const covers = i.contents
      .filter((c) => c.startsWith(".audio-covers/"))
      .map((c) => c.slice(".audio-covers/".length));
    const list = (state.db.audios[i.id] ?? [])
      .filter((e) => !i.contents.includes(e.name))
      .map((e) =>
        e.cover && covers.includes(e.cover) ? { ...e, cover: undefined } : e,
      );
    state.db.audios[i.id] = list;
    return list;
  },

  "text/getTxtData": (i: { id: string }) =>
    state.db.texts[i.id] ?? { Texts: [], Media: [] },
  "text/refreshTxtData": (i: { id: string }) =>
    state.db.texts[i.id] ?? { Texts: [], Media: [] },
  "text/setTxt": (i: { id: string; txtName: string; txtContent: string }) => {
    state.db.chapters[i.id] = {
      ...state.db.chapters[i.id],
      [i.txtName]: i.txtContent,
    };
    return i;
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify({ json: body, meta: [] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorJson = (code: string, status: number, message: string) =>
  json({ defined: false, code, status, message, data: {} }, status);

const RPC_PREFIX = `${location.origin}/rpc/`;
const MEDIA_PREFIX = `${location.origin}/media/`;

async function answer(req: Request): Promise<Response> {
  const route = req.url.slice(RPC_PREFIX.length);
  if (state.scenario === "loading" && state.affects(route))
    return new Promise<Response>(() => {});
  await delay(150);
  if (state.scenario === "error" && state.affects(route))
    return errorJson(
      "INTERNAL_SERVER_ERROR",
      500,
      "Mock server error: couldn't read the database file",
    );
  // "No results" on an item page means the item doesn't exist (the library uses a preset filter)
  if (state.scenario === "noresults" && route === "main/getContent")
    return errorJson("NOT_FOUND", 404, "Mock: this item doesn't exist");
  const handler = handlers[route];
  if (!handler) return errorJson("NOT_FOUND", 404, `No mock for ${route}`);
  const body = await req.json().catch(() => ({}));
  try {
    return json(handler(body?.json));
  } catch (e) {
    if (e instanceof MockError) return errorJson(e.code, e.status, e.message);
    throw e;
  }
}

/** The chapter text the text page fetches straight from /media/Texts/<item>/<chapter>. */
async function answerChapter(url: URL): Promise<Response> {
  const [, , , folder, ...rest] = url.pathname.split("/");
  const id =
    decodeURIComponent(folder ?? "")
      .split(".")
      .pop() ?? "";
  const chapter = decodeURIComponent(rest.join("/"));
  if (state.scenario === "loading") return new Promise<Response>(() => {});
  await delay(150);
  const text = state.db.chapters[id]?.[chapter];
  return text === undefined
    ? new Response("missing", { status: 404 })
    : new Response(text, { headers: { "Content-Type": "text/markdown" } });
}

// ── Covers: /media/... URLs become generated gradients ─────────────────────────
const RATIOS = [16 / 9, 4 / 3, 1, 3 / 4, 9 / 16, 2, 1 / 2.4];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function gradient(path: string, full: boolean) {
  const decoded = decodeURIComponent(path);
  const id = Object.keys(RATIO_BY_ID).find((k) => decoded.includes(k));
  const ratio =
    (id && RATIO_BY_ID[id]) ||
    (RATIOS[hash(decoded) % RATIOS.length] as number);
  const w = full ? 1600 : 640;
  const h = Math.round(w / ratio);
  const hue = hash(decoded) % 360;
  const label = decoded.split("/").pop()?.slice(0, 28) ?? "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 65% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 70) % 360} 60% 32%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="white" fill-opacity=".8" font-family="monospace" font-size="${Math.round(w / 22)}" text-anchor="middle">${w}x${h}${full ? "" : ` · ${label.replace(/[<>&"]/g, "")}`}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Fails to decode on purpose, so the "cover file is missing" fallback can be seen.
const BROKEN_IMAGE = "data:image/png;base64,AAAA";

function mediaPath(value: string) {
  if (value.startsWith("/media/")) return value;
  if (value.startsWith(MEDIA_PREFIX))
    return value.slice(location.origin.length);
  return null;
}

/** What to set instead: a string, `null` to skip the assignment, or `undefined` to leave it alone. */
function rewrite(tag: string, name: string, value: unknown) {
  const path = typeof value === "string" ? mediaPath(value) : null;
  if (!path) return undefined;
  if (tag === "IMG" && name === "src") {
    const missing = [...state.db.noCover].some((id) => path.includes(id));
    if (missing && path.includes("/.covers/")) return BROKEN_IMAGE;
    const small =
      path.includes("/.covers/") ||
      path.includes("-covers/") ||
      path.includes("/.media/");
    return gradient(path.replace("/.covers/cover.", "/"), !small);
  }
  if (tag === "VIDEO" && name === "poster")
    return gradient(path.replace("/.covers/cover.", "/"), false);
  // Real video, audio and caption files aren't available in the mock: don't request them.
  if (name === "src" && ["VIDEO", "AUDIO", "SOURCE", "TRACK"].includes(tag))
    return null;
  return undefined;
}

// React assigns `img.src` as a property and other code may use setAttribute, so patch both.
function installMediaPatch() {
  const original = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    const next = rewrite(this.tagName, name, value);
    if (next === null) return;
    return original.call(this, name, next ?? value);
  };
  const props: [typeof HTMLElement.prototype, string][] = [
    [HTMLImageElement.prototype, "src"],
    [HTMLVideoElement.prototype, "poster"],
    [HTMLVideoElement.prototype, "src"],
    [HTMLAudioElement.prototype, "src"],
    [HTMLSourceElement.prototype, "src"],
    [HTMLTrackElement.prototype, "src"],
  ];
  for (const [proto, name] of props) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc?.set) continue;
    Object.defineProperty(proto, name, {
      ...desc,
      set(this: HTMLElement, value: string) {
        const next = rewrite(this.tagName, name, value);
        if (next === null) return;
        desc.set?.call(this, next ?? value);
      },
    });
  }
}

let installed = false;
export function installMock() {
  if (installed) return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const req = new Request(input, init);
    if (req.url.startsWith(RPC_PREFIX)) return answer(req);
    if (req.url.startsWith(`${location.origin}/media/Texts/`))
      return answerChapter(new URL(req.url));
    return realFetch(input, init);
  };
  installMediaPatch();
}
