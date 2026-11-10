import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
} from "node:fs/promises";
import { ORPCError } from "@orpc/server";
import {
  createEnqueue,
  type DownloadEnv,
  downloadItem,
  loadConfig,
  moveFinished,
  safeTitle,
} from "@tagapp/utils/download";
import {
  type ContentWebType,
  type CType,
  contentWebSchema,
} from "@tagapp/utils/types";
import YTDlpWrapModule from "yt-dlp-wrap-plus";
import { contentDataDB } from "../db/contentData.js";
import { pathExists } from "../lib/fsBaseNameFunctions.js";
import { createLock, withSyncLock } from "../lib/syncLock.js";
import { SYNC } from "./getSyncData.js";
import { syncContent } from "./syncContent.js";

// A CJS package: the bundled server gets `{ default: class }` instead of the class (source runs get the class)
const YTDlpWrap =
  (YTDlpWrapModule as unknown as { default?: typeof YTDlpWrapModule })
    .default ?? YTDlpWrapModule;

const DIR = "./Download";
const QUEUE = `${DIR}/tmp.json`;
/** One record per download id: the persistent state, see `DownloadRecord`. */
const HISTORY = `${DIR}/history.json`;
/** Failures appended by `runItem` (the CLI writes the same file from its cwd). */
const ERROR_LOG = `${DIR}/error.log`;
/** `readErrorLog` returns at most this many trailing bytes. */
export const ERROR_LOG_MAX = 1024 * 1024;
const TMP = `${DIR}/tmp`;
/** One staging folder per finished item: `Download/done/<id>/`. */
const DONE = `${DIR}/done`;
const THROTTLE_MS = 250;

export type TaskStatus =
  | "queued"
  | "downloading"
  | "importing"
  | "completed"
  | "failed"
  | "cancelled";

/** What `Download/history.json` holds per id; written on status changes only, never on progress ticks. */
export interface DownloadRecord {
  id: string;
  title: string;
  scraper: string;
  url: string;
  /** The remote cover URL of the queue item. */
  cover?: string;
  /** The library type, known once the item is imported. */
  type?: CType;
  status: TaskStatus;
  /** 0-100, as of the last status change (live progress is only in the overlay). */
  percent: number;
  /** Set when `status` is `failed`. */
  error?: string;
  // Unix timestamps in seconds, like the DB
  /** Entered the queue (`POST /downloads/set`); re-posting keeps the first one. */
  queuedAt: number;
  /** The download (or the retried import) began. */
  startedAt?: number;
  /** Completed, failed or cancelled. */
  finishedAt?: number;
}

/** A record as the web sees it: the live overlay is merged in. */
export interface DownloadTask extends DownloadRecord {
  speed: string;
  eta: string;
  /** Completed items still in the library: the DB's `added`. Look the item up by `id` (+ `type`) in `main.getAllContent`. */
  added?: number;
}

/** Queue order (unfinished items), then the completed history, newest first. */
export interface DownloadsSnapshot {
  running: boolean;
  tasks: DownloadTask[];
}

type History = Record<string, DownloadRecord>;
type Live = { percent: number; speed: string; eta: string };

let running = false;
/** Live progress of the items of the current run that are downloading/importing; nothing else is kept in memory. */
const live = new Map<string, Live>();
/** One per item of the current run still to finish; aborted by `cancelDownloads`. */
const aborts = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** For tests: how much live state is held in memory (0 once a run is over). */
export const liveStateSize = () => live.size + aborts.size;

const now = () => Math.floor(Date.now() / 1000);
const ACTIVE = new Set<TaskStatus>(["queued", "downloading", "importing"]);
/** Part of the current run and not finished. */
const isActive = (id: string, history: History) =>
  aborts.has(id) && ACTIVE.has(history[id]?.status as TaskStatus);

/** The id becomes a folder name and part of every file name. */
export const isSafeId = (id: string) =>
  id !== "" && !/[\\/]/.test(id) && id !== "." && id !== "..";

/** Status changes notify at once; progress ticks are coalesced to one notification per THROTTLE_MS. */
function changed(urgent: boolean) {
  const notify = () => {
    timer = undefined;
    for (const l of listeners) l();
  };
  if (urgent) {
    clearTimeout(timer);
    notify();
  } else timer ??= setTimeout(notify, THROTTLE_MS);
}

/** Full snapshot now, then again after every change (coalesced); ends when `signal` aborts. */
export async function* watchDownloads(signal?: AbortSignal) {
  let dirty = true;
  let wake: (() => void) | undefined;
  const onChange = () => {
    dirty = true;
    wake?.();
  };
  listeners.add(onChange);
  signal?.addEventListener("abort", onChange, { once: true });
  try {
    while (!signal?.aborted) {
      if (!dirty) await new Promise<void>((resolve) => (wake = resolve));
      wake = undefined;
      if (signal?.aborted) break;
      dirty = false;
      yield await getDownloadsSnapshot();
    }
  } finally {
    listeners.delete(onChange);
    signal?.removeEventListener("abort", onChange);
  }
}

// --- queue file (Download/tmp.json) ---------------------------------------------------------

const withQueueLock = createLock();
// First item wins, so one id is never queued (or downloaded) twice
const uniqueById = (items: ContentWebType[]) =>
  items.filter((item, n) => items.findIndex((i) => i.id === item.id) === n);

/** A missing file is `undefined`. Not `Bun.file().json()`: it can read a half-replaced file while `rename` swaps it in. */
async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

/** The queue; a missing file is an empty queue, an invalid one throws. */
export async function readQueue() {
  const data = await readJson(QUEUE);
  return data === undefined
    ? []
    : uniqueById(contentWebSchema.array().parse(data));
}

// Written to a temp file first so a reader never sees half a queue
async function writeQueue(items: ContentWebType[]) {
  await Bun.write(`${QUEUE}.tmp`, JSON.stringify(items, null, 2));
  await rename(`${QUEUE}.tmp`, QUEUE);
}

// --- history file (Download/history.json) ---------------------------------------------------
// The file is the source of truth and is read on every use (snapshot, cancel, set...): no copy of it
// is kept in memory. A missing file is an empty history, an invalid one throws.

const withHistoryLock = createLock();

const newRecord = (item: ContentWebType, queuedAt: number): DownloadRecord => ({
  id: item.id,
  title: item.title,
  scraper: item.scraper,
  url: item.url,
  cover: item.cover,
  status: "queued",
  percent: 0,
  queuedAt,
});

async function readHistory(): Promise<History> {
  return ((await readJson(HISTORY)) ?? {}) as History;
}

/** Read-modify-write under one lock, written atomically (temp file + rename). `fn` may throw to abort the write. */
const mutateHistory = <T = void>(fn: (h: History) => T) =>
  withHistoryLock(async () => {
    const history = await readHistory();
    const result = fn(history);
    await Bun.write(`${HISTORY}.tmp`, JSON.stringify(history, null, 2));
    await rename(`${HISTORY}.tmp`, HISTORY);
    return result;
  });

/**
 * Status change of one item of the run. A history write failure is only logged (the download and
 * import matter more). With a `signal`, an item cancelled before its turn in the lock throws instead of
 * moving on: that is what keeps `importing` atomic against `cancelDownloads`.
 */
async function transition(
  id: string,
  fields: Partial<DownloadRecord>,
  signal?: AbortSignal,
) {
  try {
    await mutateHistory((h) => {
      signal?.throwIfAborted();
      if (h[id]) Object.assign(h[id], fields);
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    console.error(`Could not write ${HISTORY}:`, e);
  }
  changed(true);
}

/** Terminal change: the record keeps the last live percent, the overlay is dropped. */
async function finish(id: string, fields: Partial<DownloadRecord>) {
  const percent = live.get(id)?.percent;
  await transition(id, {
    ...(percent !== undefined && { percent }),
    ...fields,
    finishedAt: now(),
  });
  live.delete(id);
  changed(true);
}

/** Merged view: the queue (in order), then completed history. Interrupted live states read as queued. */
export async function getDownloadsSnapshot(): Promise<DownloadsSnapshot> {
  // queue first: an item that completes in between then shows up (as completed) in the history read after it
  const queue = await readQueue();
  const history = await readHistory();
  const fallback = Math.floor(Bun.file(QUEUE).lastModified / 1000); // hand-edited queue: no record yet
  const task = (r: DownloadRecord): DownloadTask => {
    const l = live.get(r.id);
    // downloading/importing outside the current run: a restart (or crash) interrupted it
    const stale =
      (r.status === "downloading" || r.status === "importing") &&
      !aborts.has(r.id);
    return {
      ...r,
      ...(stale && {
        status: "queued" as const,
        percent: 0,
        startedAt: undefined,
      }),
      ...(l && { percent: l.percent }),
      speed: l?.speed ?? "",
      eta: l?.eta ?? "--:--",
      ...(r.status === "completed" && {
        added: contentDataDB.data[r.id]?.added,
      }),
    };
  };
  const open = queue
    .filter((i) => history[i.id]?.status !== "completed")
    .map((i) => task(history[i.id] ?? newRecord(i, fallback)));
  const done = Object.values(history)
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .map(task);
  return { running, tasks: [...open, ...done] };
}

/**
 * Replaces the queue (`POST /downloads/set`). While a run is active, items it has not
 * finished yet are kept as they are: they are never dropped, and a posted copy of the same
 * id is ignored. The run itself only works on the queue it started with, so newly posted
 * items wait for the next `start`. Every queued item gets a history record (an existing
 * unfinished one keeps its `queuedAt`; a completed one is replaced); unfinished records of items that
 * left the queue are dropped. Returns what was written.
 */
export const setQueue = (items: ContentWebType[]) =>
  withQueueLock(async () => {
    const history = await readHistory();
    const keep = running
      ? (await readQueue()).filter((i) => isActive(i.id, history))
      : [];
    const kept = new Set(keep.map((i) => i.id));
    const next = uniqueById([...keep, ...items.filter((i) => !kept.has(i.id))]);
    await writeQueue(next);
    const at = now();
    const ids = new Set(next.map((i) => i.id));
    await mutateHistory((h) => {
      for (const [id, r] of Object.entries(h))
        if (r.status !== "completed" && !ids.has(id)) delete h[id];
      for (const i of next) {
        const r = h[i.id];
        if (r && r.status !== "completed")
          Object.assign(r, {
            title: i.title,
            scraper: i.scraper,
            url: i.url,
            cover: i.cover,
          });
        else h[i.id] = newRecord(i, at);
      }
    });
    changed(true);
    return next;
  });

/** Drops completed records from the history (all, or the given ids). The library and media are never touched. Returns how many. */
export async function clearFinished(ids?: string[]) {
  const cleared = await mutateHistory((h) => {
    let n = 0;
    for (const [id, r] of Object.entries(h))
      if (r.status === "completed" && (!ids || ids.includes(id))) {
        delete h[id];
        n++;
      }
    return n;
  });
  changed(true);
  return cleared;
}

const removeFromQueue = (id: string) =>
  withQueueLock(async () =>
    writeQueue((await readQueue()).filter((i) => i.id !== id)),
  );

// --- run ------------------------------------------------------------------------------------

/** Moves the staged files into the library through the sync services. Throws if the item did not get in. */
async function importStaged(item: ContentWebType, stage: string) {
  if (contentDataDB.data[item.id])
    throw new Error(`id ${item.id} is already in the library`);
  await syncContent(stage);
  if (!contentDataDB.data[item.id])
    throw new Error(
      `Not imported (invalid metadata, unsupported file or a failed move, see the server log). Files are in ${stage}, unsupported ones in ./UnSyncable`,
    );
}

async function processItem(
  item: ContentWebType,
  env: DownloadEnv,
  controller: AbortController,
) {
  const { signal } = controller;
  const stage = `${DONE}/${item.id}`;
  const progress = (p: Partial<Live>) => {
    const l = live.get(item.id);
    if (!l) return;
    Object.assign(l, p);
    changed(false);
  };
  let startedAt: number | undefined;
  try {
    // Cancelled while still waiting in the p-queue: never starts
    signal.throwIfAborted();
    if (!isSafeId(item.id)) throw new Error(`Unsafe id "${item.id}"`);

    // A staging folder with files is left over from an import that failed earlier
    // (duplicate id, bad metadata...): retry the import instead of downloading again.
    const sidecar = `${stage}/${safeTitle(item.title)}.${item.id}.json`;
    const staged = await pathExists(sidecar);
    // Already in the library (synced by hand, or posted again): nothing to download
    if (!staged && contentDataDB.data[item.id]) {
      await removeFromQueue(item.id);
      await finish(item.id, {
        status: "completed",
        percent: 100,
        type: contentDataDB.data[item.id]?.type,
      });
      return;
    }
    if (!staged) {
      startedAt = now();
      live.set(item.id, { percent: 0, speed: "0B/s", eta: "--:--" });
      // a cancel that got in first makes this throw
      await transition(item.id, { status: "downloading", startedAt }, signal);
      await downloadItem(item, env, progress, signal);
      signal.throwIfAborted();
      // The sidecar title matches the file names, which is what prepareSync expects
      const moved = moveFinished(
        { ...item, title: safeTitle(item.title) },
        TMP,
        stage,
      );
      if (!moved.length) {
        // no sidecar left behind, or the next run would skip the download
        await rm(sidecar);
        await rmdir(stage).catch(() => {});
        throw new Error("The download finished but produced no files");
      }
    }

    startedAt ??= now();
    live.set(item.id, { percent: 100, speed: "0B/s", eta: "00:00" });
    // from here a cancel finds `importing` and leaves it alone (the guard throws if it came first)
    await transition(
      item.id,
      { status: "importing", percent: 100, startedAt },
      signal,
    );
    await importStaged(item, stage);
    // only an empty folder goes: anything left in it is not ours to delete
    await rmdir(stage).catch((e) =>
      console.error(`Could not remove ${stage}:`, e),
    );
    await removeFromQueue(item.id);
    await finish(item.id, {
      status: "completed",
      percent: 100,
      type: contentDataDB.data[item.id]?.type,
    });
  } catch (error) {
    // `cancelDownloads` already set the status; a cancel is not a failure (no error.log)
    if (signal.aborted) return;
    const err = error as Error | undefined;
    const message = err?.message ?? "Unknown error";
    await finish(item.id, { status: "failed", error: message });
    await appendFile(
      ERROR_LOG,
      `[${item.title}]: ${message}\n${err?.stack ?? ""}\n`,
    ).catch(() => {});
  } finally {
    aborts.delete(item.id);
    live.delete(item.id);
  }
}

/** The tail of `error.log` (missing file = empty); `truncated` when older entries were cut. */
export async function readErrorLog() {
  const file = Bun.file(ERROR_LOG);
  if (!(await file.exists())) return { text: "", truncated: false };
  const size = file.size;
  if (size <= ERROR_LOG_MAX)
    return { text: await file.text(), truncated: false };
  const tail = await file.slice(size - ERROR_LOG_MAX).text();
  // the cut can land mid-line (or mid-character): start at the next full line
  return { text: tail.slice(tail.indexOf("\n") + 1), truncated: true };
}

export const clearErrorLog = () => rm(ERROR_LOG, { force: true });

/**
 * Starts a run over the queue in `Download/tmp.json` unless one is already going (then it
 * does nothing). Same rules as the CLI: one download per scraper, three overall. Every
 * finished item goes straight into the library; failures stay in the queue.
 * Resolves with whether a run was started; the run continues in the background.
 */
export async function startDownloads(ytDlp?: DownloadEnv["ytDlp"]) {
  if (running) return false;
  running = true;
  let queue: ContentWebType[];
  let env: DownloadEnv;
  try {
    queue = await readQueue();
    if (!queue.length) {
      running = false;
      return false;
    }
    env = {
      config: loadConfig(`${DIR}/config.json`),
      tmpDir: TMP,
      cookiesDir: `${DIR}/cookies`,
      ytDlp: ytDlp ?? new YTDlpWrap(),
    };
    await Promise.all([
      mkdir(TMP, { recursive: true }),
      mkdir(DONE, { recursive: true }),
    ]);
    // Every item of the run starts over as queued (a failed or cancelled one loses its old state, keeps `queuedAt`)
    const at = now();
    await mutateHistory((h) => {
      for (const i of queue) {
        const r = h[i.id];
        h[i.id] = newRecord(i, r && r.status !== "completed" ? r.queuedAt : at);
      }
    });
  } catch (error) {
    running = false;
    throw error;
  }

  aborts.clear();
  for (const { id } of queue) aborts.set(id, new AbortController());
  changed(true);

  const enqueue = createEnqueue();
  void Promise.all(
    queue.map((item) =>
      enqueue(item.scraper, () =>
        processItem(item, env, aborts.get(item.id) as AbortController),
      ),
    ),
  ).finally(() => {
    running = false;
    aborts.clear();
    live.clear();
    changed(true);
  });
  return true;
}

/**
 * Cancels `id`, or every item of the run, that is `queued` or `downloading`: the record becomes
 * `cancelled`, yt-dlp is killed / `fetch` aborted, and the item stays in the queue with its
 * partial files in `Download/tmp` (the next `start` resumes it). An `importing` item is not
 * cancelled: it runs under `withSyncLock` and is atomic. Returns how many were cancelled.
 */
export async function cancelDownloads(id?: string) {
  const cancelled = await mutateHistory((h) => {
    let n = 0;
    for (const [rid, controller] of aborts) {
      const r = h[rid];
      if ((id !== undefined && rid !== id) || !r) continue;
      if (r.status !== "queued" && r.status !== "downloading") continue;
      Object.assign(r, {
        status: "cancelled",
        percent: live.get(rid)?.percent ?? r.percent,
        finishedAt: now(),
      });
      live.delete(rid);
      controller.abort();
      n++;
    }
    return n;
  });
  changed(true);
  return cancelled;
}

/**
 * Drops items from `Download/tmp.json` (the user's "clear failed"). Refused (CONFLICT, nothing
 * changed) if any is `queued`/`downloading`/`importing`: cancel it first. Staged files of a
 * failed import (`Download/done/<id>/`) are moved to `Sync/` so they can be fixed on the
 * `/sync` page; a name clash there is a CONFLICT and nothing moves. Their history records
 * (all but completed ones) go too. Incomplete downloads (`.part`, `.ytdl`, `.temp`) of the id
 * in `Download/tmp` are deleted last. Returns the ids that were in the queue.
 */
export const removeDownloads = (ids: string[]) =>
  withSyncLock(async () => {
    if (ids.some((id) => !isSafeId(id)))
      throw new ORPCError("BAD_REQUEST", { message: "Unsafe id" });
    const history = await readHistory();
    const busy = ids.find((id) => isActive(id, history));
    if (busy)
      throw new ORPCError("CONFLICT", {
        message: `"${busy}" is queued or running: cancel it first`,
      });

    const staged = new Map<string, string[]>();
    for (const id of ids)
      staged.set(
        id,
        await readdir(`${DONE}/${id}`).catch((e: NodeJS.ErrnoException) => {
          if (e.code === "ENOENT") return [];
          throw e;
        }),
      );
    // rename would silently replace a file of the same name
    for (const file of [...staged.values()].flat())
      if (await pathExists(`${SYNC}/${file}`))
        throw new ORPCError("CONFLICT", {
          message: `Sync already has "${file}"`,
        });

    const moved: [string, string][] = [];
    const undo = async () => {
      for (const [from, to] of moved.reverse())
        await rename(to, from).catch((e) =>
          console.error(`Failed to rollback ${to}:`, e),
        );
    };
    let removed: string[] = [];
    try {
      for (const [id, files] of staged)
        for (const file of files) {
          await rename(`${DONE}/${id}/${file}`, `${SYNC}/${file}`);
          moved.push([`${DONE}/${id}/${file}`, `${SYNC}/${file}`]);
        }
      await withQueueLock(async () => {
        const queue = await readQueue();
        removed = queue.filter((i) => ids.includes(i.id)).map((i) => i.id);
        await writeQueue(queue.filter((i) => !ids.includes(i.id)));
      });
    } catch (error) {
      await undo();
      throw error;
    }

    // The data is safe by now; what follows is cleanup
    for (const id of ids) {
      await rmdir(`${DONE}/${id}`).catch(() => {});
      aborts.delete(id);
      const partial = new RegExp(
        `\\.${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\..+\\.(part(-Frag\\d+)?|ytdl|temp)$`,
      );
      for (const file of await readdir(TMP).catch(() => []))
        if (partial.test(file)) await rm(`${TMP}/${file}`, { force: true });
    }
    // an unfinished record without a queue item is ignored by the snapshot and pruned by `setQueue`, so a failure here is harmless
    await mutateHistory((h) => {
      for (const id of ids) if (h[id]?.status !== "completed") delete h[id];
    }).catch((e) => console.error(`Could not write ${HISTORY}:`, e));
    changed(true);
    return removed;
  });
