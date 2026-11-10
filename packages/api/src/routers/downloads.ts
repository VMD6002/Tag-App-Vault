import { os } from "@orpc/server";
import z from "zod";
import {
  cancelDownloads,
  clearFinished as clearAllFinished,
  clearErrorLog as clearLog,
  isSafeId,
  readErrorLog,
  removeDownloads,
  startDownloads,
  watchDownloads,
} from "../services/downloads.js";

/** `started` is false when a run is already going or the queue is empty. */
export const start = os.handler(async () => ({
  started: await startDownloads(),
}));

/** Event stream: a full `DownloadsSnapshot` (queue + history) at once, then again on every change. */
export const watch = os.handler(({ signal }) => watchDownloads(signal));

/** Without `id`, cancels every queued/downloading item of the run. `importing` items are never cancelled. */
export const cancel = os
  .input(z.object({ id: z.string().optional() }))
  .handler(async ({ input }) => ({
    cancelled: await cancelDownloads(input.id),
  }));

/** Drops items from the queue; staged files of a failed import go to `Sync/`. Active items are refused. */
export const remove = os
  .input(z.object({ ids: z.string().refine(isSafeId).array() }))
  .handler(async ({ input }) => ({
    removed: await removeDownloads(input.ids),
  }));

/** Drops completed records from the download history (all, or `ids`); never touches the library or media. */
export const clearFinished = os
  .input(z.object({ ids: z.string().array().optional() }).optional())
  .handler(async ({ input }) => ({
    cleared: await clearAllFinished(input?.ids),
  }));

/** `Download/error.log` (the last 1 MB at most, `truncated` says so); empty when there is none. */
export const getErrorLog = os.handler(() => readErrorLog());

/** Deletes `Download/error.log`; a missing file is fine. */
export const clearErrorLog = os.handler(async () => {
  await clearLog();
});
