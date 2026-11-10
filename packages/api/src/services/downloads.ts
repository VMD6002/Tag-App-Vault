import { appendFile, mkdir, rename, rm, rmdir } from "node:fs/promises";
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
import { createLock } from "../lib/syncLock.js";
import { syncContent } from "./syncContent.js";

const DIR = "./Download";
const QUEUE = `${DIR}/tmp.json`;
const TMP = `${DIR}/tmp`;
/** One staging folder per finished item: `Download/done/<id>/`. */
const DONE = `${DIR}/done`;
const THROTTLE_MS = 250;

export type TaskStatus =
  | "queued"
  | "downloading"
  | "importing"
  | "completed"
  | "failed";

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
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const isActive = (t?: DownloadTask) =>
  t?.status === "queued" ||
  t?.status === "downloading" ||
  t?.status === "importing";

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

async function processItem(item: ContentWebType, env: DownloadEnv) {
  const stage = `${DONE}/${item.id}`;
  try {
    // The id becomes a folder name and part of every file name
    if (/[\\/]/.test(item.id) || item.id === "." || item.id === "..")
      throw new Error(`Unsafe id "${item.id}"`);

    // A staging folder with files is left over from an import that failed earlier
    // (duplicate id, bad metadata...): retry the import instead of downloading again.
    const sidecar = `${stage}/${safeTitle(item.title)}.${item.id}.json`;
    if (!(await pathExists(sidecar))) {
      update(item.id, { status: "downloading" });
      await downloadItem(item, env, (p) => update(item.id, p, false));
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
    const err = error as Error | undefined;
    const message = err?.message ?? "Unknown error";
    update(item.id, { status: "failed", error: message });
    await appendFile(
      `${DIR}/error.log`,
      `[${item.title}]: ${message}\n${err?.stack ?? ""}\n`,
    ).catch(() => {});
  }
}

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
    queue.map((item) => enqueue(item.scraper, () => processItem(item, env))),
  ).finally(() => {
    running = false;
    changed(true);
  });
  return true;
}
