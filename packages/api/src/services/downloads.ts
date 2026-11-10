import {
  appendFile,
  mkdir,
  readdir,
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
import { type ContentWebType, contentWebSchema } from "@tagapp/utils/types";
import YTDlpWrap from "yt-dlp-wrap-plus";
import { contentDataDB } from "../db/contentData.js";
import { pathExists } from "../lib/fsBaseNameFunctions.js";
import { createLock, withSyncLock } from "../lib/syncLock.js";
import { SYNC } from "./getSyncData.js";
import { syncContent } from "./syncContent.js";

const DIR = "./Download";
const QUEUE = `${DIR}/tmp.json`;
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

export interface DownloadTask {
  id: string;
  title: string;
  scraper: string;
  status: TaskStatus;
  percent: number;
  speed: string;
  eta: string;
  /** Set when `status` is `failed`. */
  error?: string;
}

export interface DownloadsSnapshot {
  running: boolean;
  tasks: DownloadTask[];
}

let running = false;
let tasks = new Map<string, DownloadTask>();
/** One per item of the current run; aborted by `cancelDownloads`. */
let aborts = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const isActive = (t?: DownloadTask) =>
  t?.status === "queued" ||
  t?.status === "downloading" ||
  t?.status === "importing";

/** The id becomes a folder name and part of every file name. */
export const isSafeId = (id: string) =>
  id !== "" && !/[\\/]/.test(id) && id !== "." && id !== "..";

export const getDownloadsSnapshot = (): DownloadsSnapshot => ({
  running,
  tasks: [...tasks.values()].map((t) => ({ ...t })),
});

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

function update(id: string, fields: Partial<DownloadTask>, urgent = true) {
  const task = tasks.get(id);
  if (!task) return;
  Object.assign(task, fields);
  changed(urgent);
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
      yield getDownloadsSnapshot();
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

/** The queue; a missing file is an empty queue, an invalid one throws. */
export async function readQueue() {
  const file = Bun.file(QUEUE);
  if (!(await file.exists())) return [];
  return uniqueById(contentWebSchema.array().parse(await file.json()));
}

// Written to a temp file first so a reader never sees half a queue
async function writeQueue(items: ContentWebType[]) {
  await Bun.write(`${QUEUE}.tmp`, JSON.stringify(items, null, 2));
  await rename(`${QUEUE}.tmp`, QUEUE);
}

/**
 * Replaces the queue (`POST /downloads/set`). While a run is active, items it has not
 * finished yet are kept as they are: they are never dropped, and a posted copy of the same
 * id is ignored. The run itself only works on the queue it started with, so newly posted
 * items wait for the next `start`. Returns what was written.
 */
export const setQueue = (items: ContentWebType[]) =>
  withQueueLock(async () => {
    const keep = running
      ? (await readQueue()).filter((i) => isActive(tasks.get(i.id)))
      : [];
    const kept = new Set(keep.map((i) => i.id));
    const next = uniqueById([...keep, ...items.filter((i) => !kept.has(i.id))]);
    await writeQueue(next);
    return next;
  });

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
  { signal }: AbortController,
) {
  const stage = `${DONE}/${item.id}`;
  try {
    // Cancelled while still waiting in the p-queue: never starts
    signal.throwIfAborted();
    if (!isSafeId(item.id)) throw new Error(`Unsafe id "${item.id}"`);

    // A staging folder with files is left over from an import that failed earlier
    // (duplicate id, bad metadata...): retry the import instead of downloading again.
    const sidecar = `${stage}/${safeTitle(item.title)}.${item.id}.json`;
    const staged = await pathExists(sidecar);
    // From the last abort check to `importing` nothing awaits, so a cancel can't slip in between
    signal.throwIfAborted();
    if (!staged) {
      update(item.id, { status: "downloading" });
      await downloadItem(item, env, (p) => update(item.id, p, false), signal);
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

    update(item.id, {
      status: "importing",
      percent: 100,
      speed: "0B/s",
      eta: "00:00",
    });
    await importStaged(item, stage);
    // only an empty folder goes: anything left in it is not ours to delete
    await rmdir(stage).catch((e) =>
      console.error(`Could not remove ${stage}:`, e),
    );
    await removeFromQueue(item.id);
    update(item.id, { status: "completed" });
  } catch (error) {
    // `cancelDownloads` already set the status; a cancel is not a failure (no error.log)
    if (signal.aborted) return;
    const err = error as Error | undefined;
    const message = err?.message ?? "Unknown error";
    update(item.id, { status: "failed", error: message });
    await appendFile(
      ERROR_LOG,
      `[${item.title}]: ${message}\n${err?.stack ?? ""}\n`,
    ).catch(() => {});
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
  } catch (error) {
    running = false;
    throw error;
  }

  aborts = new Map(queue.map(({ id }) => [id, new AbortController()]));
  tasks = new Map(
    queue.map(({ id, title, scraper }) => [
      id,
      {
        id,
        title,
        scraper,
        status: "queued",
        percent: 0,
        speed: "0B/s",
        eta: "--:--",
      },
    ]),
  );
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
    changed(true);
  });
  return true;
}

/**
 * Cancels `id`, or every item of the run, that is `queued` or `downloading`: the task becomes
 * `cancelled`, yt-dlp is killed / `fetch` aborted, and the item stays in the queue with its
 * partial files in `Download/tmp` (the next `start` resumes it). An `importing` item is not
 * cancelled: it runs under `withSyncLock` and is atomic. Returns how many were cancelled.
 */
export function cancelDownloads(id?: string) {
  let cancelled = 0;
  for (const task of tasks.values()) {
    if (id !== undefined && task.id !== id) continue;
    if (task.status !== "queued" && task.status !== "downloading") continue;
    update(task.id, { status: "cancelled", speed: "", eta: "--:--" });
    aborts.get(task.id)?.abort();
    cancelled++;
  }
  return cancelled;
}

/**
 * Drops items from `Download/tmp.json` (the user's "clear failed"). Refused (CONFLICT, nothing
 * changed) if any is `queued`/`downloading`/`importing`: cancel it first. Staged files of a
 * failed import (`Download/done/<id>/`) are moved to `Sync/` so they can be fixed on the
 * `/sync` page; a name clash there is a CONFLICT and nothing moves. Incomplete downloads
 * (`.part`, `.ytdl`, `.temp`) of the id in `Download/tmp` are deleted last. Returns the ids
 * that were in the queue.
 */
export const removeDownloads = (ids: string[]) =>
  withSyncLock(async () => {
    if (ids.some((id) => !isSafeId(id)))
      throw new ORPCError("BAD_REQUEST", { message: "Unsafe id" });
    const busy = ids.find((id) => isActive(tasks.get(id)));
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
      tasks.delete(id);
      const partial = new RegExp(
        `\\.${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\..+\\.(part(-Frag\\d+)?|ytdl|temp)$`,
      );
      for (const file of await readdir(TMP).catch(() => []))
        if (partial.test(file)) await rm(`${TMP}/${file}`, { force: true });
    }
    changed(true);
    return removed;
  });
