// Fake TagAppVault server for the dev-only #/mock pages. A patched `fetch` answers the app's oRPC
// calls (`/rpc/<router>/<procedure>`) and chapter text from memory, and cover/media URLs under
// `/media/` are swapped for generated gradients so no image is ever requested.
import {
  addGroupItems,
  changeGroupId,
  createGroup,
  deleteGroup,
  disbandGroup,
  fixGroups,
  type GroupState,
  mergeGroups,
  newGroupId,
  planDeleteGroup,
  removeGroupItems,
  updateGroup,
} from "@tagapp/utils";
import type { ContentServerType, GroupType } from "@tagapp/utils/types";
import {
  buildDb,
  buildDownloads,
  buildErrorLog,
  buildSync,
  countTags,
  type MockDb,
  type MockSyncItem,
  type MockTask,
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
  /** Items waiting in Sync, by id. */
  pending: Record<string, MockSyncItem>;
  tags: Record<string, number>;
  errorLog: string;
};

const state: State = {
  scenario: "normal",
  affects: () => true,
  db: buildDb("normal"),
  pending: {},
  tags: {},
  errorLog: "",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function configureMock(
  scenario: Scenario,
  affects: State["affects"] = () => true,
) {
  state.scenario = scenario;
  state.affects = affects;
  state.db = buildDb(scenario);
  state.pending = Object.fromEntries(buildSync(scenario).map((c) => [c.id, c]));
  Object.assign(dl, buildDownloads(scenario, state.db));
  state.errorLog = buildErrorLog(scenario);
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

/** Runs a pure group op from `@tagapp/utils` on the fake db; its errors become BAD_REQUEST like the server's. */
const groupOp = <T>(
  fn: (s: GroupState<ContentServerType>, now: number) => T,
) => {
  try {
    // The ops mutate these two records in place, which are the fake db's own
    const res = fn(
      { contentData: state.db.contents, groups: state.db.groups },
      Math.floor(Date.now() / 1000),
    );
    recount();
    return res;
  } catch (e) {
    throw new MockError("BAD_REQUEST", 400, (e as Error).message);
  }
};

const pending = (name: string, type: string) => {
  const c = Object.values(state.pending).find(
    (p) => p.name === name && p.type === type,
  );
  if (!c) throw notFound(`"${name}" in Sync`);
  return c;
};

/** Like the server: a group an item newly gets must have a record, on the server or in `records` (injected). */
const checkNewGroups = (
  ids: string[],
  current: string[] = [],
  records: GroupType[] = [],
) => {
  const bad = ids.find(
    (g) =>
      !current.includes(g) &&
      !state.db.groups[g] &&
      !records.some((r) => r.id === g),
  );
  if (bad) throw new MockError("BAD_REQUEST", 400, `Unknown group: ${bad}`);
};

/** Like `addMissingGroups`: unknown ids among `ids` get their record (never overwrite, no cover). */
const registerGroups = (ids: string[], records: GroupType[] = []) => {
  for (const r of records) {
    if (!ids.includes(r.id) || state.db.groups[r.id]) continue;
    const { cover: _cover, ...rest } = r;
    state.db.groups[r.id] = { ...rest, tags: [...new Set(r.tags)] };
  }
  recount();
};

// ── Downloads: "Start downloads" replays one fake run, pushed to the open watch streams ──────────
const now = () => Math.floor(Date.now() / 1000);
/** The whole list (queue + history); like the server, `completed` entries are history. */
const dl = {
  running: false,
  tasks: [] as MockTask[],
  listeners: new Set<() => void>(),
};
const isActive = (t: MockTask) =>
  t.status === "queued" ||
  t.status === "downloading" ||
  t.status === "importing";
/** Queue order, then completed history, newest first. */
const snapshot = () => ({
  running: dl.running,
  tasks: [
    ...dl.tasks.filter((t) => t.status !== "completed"),
    ...dl.tasks
      .filter((t) => t.status === "completed")
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
  ].map((t) => ({ ...t })),
});
const notify = () => {
  for (const l of dl.listeners) l();
};

function startRun() {
  const todo = dl.tasks.filter((t) => t.status !== "completed");
  if (dl.running || todo.length === 0) return false;
  dl.running = true;
  for (const t of todo)
    Object.assign(t, {
      status: "queued",
      percent: 0,
      speed: "",
      eta: "--:--",
      error: undefined,
      startedAt: undefined,
      finishedAt: undefined,
    });
  // Stress: the last item fails and stays in the queue
  const failing = state.scenario === "stress" ? todo.at(-1)?.id : undefined;
  const timer = setInterval(() => {
    const open = todo.filter(isActive);
    for (const t of open.slice(0, 3)) {
      if (t.status === "importing") {
        t.finishedAt = now();
        if (t.id === failing) {
          t.status = "failed";
          state.errorLog += `[${t.title}]: Mock failure: already in the library\n    at importStaged (mock/import.ts:1:1)\n`;
          t.error = `Mock failure: id ${t.id} is already in the library, and the files stay in Download/done/${t.id}. ${"More detail. ".repeat(6)}`;
        } else {
          t.status = "completed";
          t.percent = 100;
          t.type = "img";
          t.added = t.finishedAt;
        }
      } else if (t.percent >= 100) t.status = "importing";
      else {
        t.status = "downloading";
        t.startedAt ??= now();
        t.percent = Math.min(100, t.percent + 8 + Math.random() * 14);
        t.speed = t.scraper === "direct" ? "Fetch" : "1.4MiB/s";
        t.eta =
          t.percent >= 100
            ? "00:00"
            : `00:0${Math.ceil((100 - t.percent) / 20)}`;
      }
    }
    if (!open.length) {
      dl.running = false;
      clearInterval(timer);
    }
    notify();
  }, 400);
  notify();
  return true;
}

/** Like the server: queued and downloading items stop (importing ones finish), they stay in the queue. */
function cancelRun(id?: string) {
  let cancelled = 0;
  for (const t of dl.tasks)
    if (
      (id === undefined || t.id === id) &&
      (t.status === "queued" || t.status === "downloading")
    ) {
      t.status = "cancelled";
      t.speed = "";
      t.eta = "--:--";
      t.finishedAt = now();
      cancelled++;
    }
  if (!dl.tasks.some(isActive)) dl.running = false;
  notify();
  return cancelled;
}

function removeItems(ids: string[]) {
  const busy = ids.find((id) =>
    dl.tasks.some((t) => t.id === id && isActive(t)),
  );
  if (busy)
    throw new MockError(
      "CONFLICT",
      409,
      `"${busy}" is queued or running: cancel it first`,
    );
  const removed = dl.tasks
    .filter((t) => ids.includes(t.id) && t.status !== "completed")
    .map((t) => t.id);
  dl.tasks = dl.tasks.filter((t) => !removed.includes(t.id));
  notify();
  return removed;
}

/** Completed history only, like the server: nothing else (and no library item) is touched. */
function clearFinished(ids?: string[]) {
  const before = dl.tasks.length;
  dl.tasks = dl.tasks.filter(
    (t) => t.status !== "completed" || (ids && !ids.includes(t.id)),
  );
  notify();
  return before - dl.tasks.length;
}

/** An oRPC event iterator: `event: message` + `data: {"json": …}` per snapshot, `event: done` at the end. */
function watchResponse() {
  const enc = new TextEncoder();
  let push: () => void;
  return new Response(
    new ReadableStream({
      start(c) {
        push = () =>
          c.enqueue(
            enc.encode(
              `event: message\ndata: ${JSON.stringify({ json: snapshot(), meta: [] })}\n\n`,
            ),
          );
        dl.listeners.add(push);
        push();
      },
      cancel() {
        dl.listeners.delete(push);
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

const handlers: Record<string, Handler> = {
  "main/getSettings": () => ({ port: 5001, prefix: "/" }),
  "main/getServerTags": () => state.tags,
  "main/getAllContent": () => state.db.contents,
  "main/getContent": (i: { id: string }) => doc(i.id),
  "main/setContent": ({
    groups,
    ...i
  }: Pick<
    ContentServerType,
    "id" | "title" | "tags" | "extraData" | "groups"
  >) => {
    const c = doc(i.id);
    // same order as the server: unknown group ids fail before anything changes
    const want = groups && [...new Set(groups)];
    const bad = want?.find((g) => !state.db.groups[g]);
    if (bad)
      throw new MockError("BAD_REQUEST", 400, `Group ${bad} doesn't exist`);
    Object.assign(c, i, { lastUpdated: Math.floor(Date.now() / 1000) });
    const had = c.groups ?? [];
    for (const id of want ?? []) {
      if (!had.includes(id))
        groupOp((s, now) => addGroupItems(s, { id, itemIds: [i.id] }, now));
    }
    for (const id of had)
      if (want && !want.includes(id))
        groupOp((s, now) => removeGroupItems(s, { id, itemIds: [i.id] }, now));
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
  "main/getSyncData": () => ({
    contents: state.pending,
    unsyncable: ["notes.xyz"],
    orphanJsons: [],
  }),
  "main/editSyncItem": (i: {
    name: string;
    type: string;
    title: string;
    tags: string[];
    extraData: string;
    groups?: string[];
    newGroups?: GroupType[];
  }) => {
    const c = pending(i.name, i.type);
    if (i.groups) {
      checkNewGroups(i.groups, c.groups, i.newGroups);
      registerGroups(i.groups, i.newGroups);
    }
    Object.assign(c, {
      title: i.title,
      tags: i.tags,
      extraData: i.extraData,
      ...(i.groups && { groups: i.groups.length ? i.groups : undefined }),
    });
  },
  "main/bulkEditSyncItems": (i: {
    items: { name: string; type: string }[];
    added?: string[];
    removed?: string[];
    addGroups?: string[];
    newGroups?: GroupType[];
  }) => {
    checkNewGroups(i.addGroups ?? [], [], i.newGroups);
    const items = i.items.map((r) => pending(r.name, r.type));
    registerGroups(i.addGroups ?? [], i.newGroups);
    for (const c of items) {
      c.tags = [
        ...new Set([
          ...c.tags.filter((t) => !i.removed?.includes(t)),
          ...(i.added ?? []),
        ]),
      ];
      const groups = [
        ...new Set([...(c.groups ?? []), ...(i.addGroups ?? [])]),
      ];
      c.groups = groups.length ? groups : undefined;
    }
    return items.map((c) => c.id);
  },
  "main/removeSyncItem": (i: { name: string; type: string }) => {
    delete state.pending[pending(i.name, i.type).id];
  },
  "main/bulkRemoveSyncItems": (i: {
    items: { name: string; type: string }[];
  }) => {
    const items = i.items.map((r) => pending(r.name, r.type));
    for (const c of items) delete state.pending[c.id];
    return items.map((c) => c.id);
  },
  "main/sync": () => {
    for (const { name: _n, ext: _e, ...c } of Object.values(state.pending))
      state.db.contents[c.id] = c;
    state.pending = {};
    recount();
    return state.db.contents;
  },
  "groups/list": () => state.db.groups,
  "groups/get": (i: { id: string }) => {
    const g = state.db.groups[i.id];
    if (!g) throw notFound(`Group ${i.id}`);
    return g;
  },
  "groups/create": (i: Parameters<typeof createGroup>[1]) =>
    groupOp((s, now) =>
      createGroup(s, { ...i, id: i.id || newGroupId() }, now),
    ),
  "groups/update": (i: Parameters<typeof updateGroup>[1]) =>
    groupOp((s, now) => updateGroup(s, i, now)),
  "groups/addItems": (i: Parameters<typeof addGroupItems>[1]) =>
    groupOp((s, now) => addGroupItems(s, i, now)),
  "groups/removeItems": (i: Parameters<typeof removeGroupItems>[1]) =>
    groupOp((s, now) => removeGroupItems(s, i, now)),
  "groups/disband": (i: { id: string }) =>
    groupOp((s, now) => disbandGroup(s, i, now)),
  "groups/planDelete": (i: { id: string }) =>
    groupOp((s) => {
      const { remove, detach } = planDeleteGroup(s, { ...i, deleteIds: [] });
      return { exclusive: remove, shared: detach };
    }),
  "groups/delete": (i: Parameters<typeof deleteGroup>[1]) =>
    groupOp((s, now) => {
      const { remove, detach, group } = deleteGroup(s, i, now);
      return {
        deleted: remove.map((c) => c.id),
        detached: detach.map((c) => c.id),
        group,
      };
    }),
  "groups/fix": (i: Parameters<typeof fixGroups>[1]) =>
    groupOp((s, now) => fixGroups(s, i, now)),
  "groups/merge": (i: Parameters<typeof mergeGroups>[1]) =>
    groupOp((s, now) => mergeGroups(s, i, now)),
  "groups/changeId": (i: Parameters<typeof changeGroupId>[1]) =>
    groupOp((s, now) => changeGroupId(s, i, now)),
  "downloads/start": () => ({ started: startRun() }),
  "downloads/cancel": (i: { id?: string }) => ({ cancelled: cancelRun(i?.id) }),
  "downloads/getErrorLog": () => ({
    text: state.errorLog,
    truncated: state.scenario === "stress",
  }),
  "downloads/clearErrorLog": () => {
    state.errorLog = "";
  },
  "downloads/clearFinished": (i?: { ids?: string[] }) => ({
    cleared: clearFinished(i?.ids),
  }),
  "downloads/remove": (i: { ids: string[] }) => ({
    removed: removeItems(i.ids),
  }),
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
  "gallery/bulkUpdateContentTags": (i: {
    id: string;
    contents: string[];
    add: string[];
    remove: string[];
  }) => {
    const list = state.db.galleries[i.id] ?? [];
    const missing = i.contents.find((c) => !list.some((e) => e.name === c));
    if (missing)
      throw new MockError(
        "NOT_FOUND",
        404,
        `File ${missing} doesn't exist in this gallery`,
      );
    // New objects, like the server: an identical reference would not re-render
    const next = list.map((e) =>
      i.contents.includes(e.name)
        ? {
            ...e,
            tags: [
              ...new Set([
                ...(e.tags ?? []).filter((t) => !i.remove.includes(t)),
                ...i.add,
              ]),
            ],
          }
        : e,
    );
    state.db.galleries[i.id] = next;
    return next;
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
  if (route === "downloads/watch") return watchResponse();
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
