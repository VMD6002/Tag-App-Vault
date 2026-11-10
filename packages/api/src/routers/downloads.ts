import { os } from "@orpc/server";
import z from "zod";
import {
  cancelDownloads,
  clearErrorLog as clearLog,
  isSafeId,
  readErrorLog,
  readQueue,
  removeDownloads,
  startDownloads,
  watchDownloads,
} from "../services/downloads.js";

export const getQueue = os.handler(() => readQueue());

/** `started` is false when a run is already going or the queue is empty. */
export const start = os.handler(async () => ({
  started: await startDownloads(),
}));

/** Event stream: a full `DownloadsSnapshot` at once, then again on every change. */
export const watch = os.handler(({ signal }) => watchDownloads(signal));

/** Without `id`, cancels every queued/downloading item of the run. `importing` items are never cancelled. */
export const cancel = os
  .input(z.object({ id: z.string().optional() }))
  .handler(({ input }) => ({ cancelled: cancelDownloads(input.id) }));

/** Drops items from the queue; staged files of a failed import go to `Sync/`. Active items are refused. */
export const remove = os
  .input(z.object({ ids: z.string().refine(isSafeId).array() }))
  .handler(async ({ input }) => ({
    removed: await removeDownloads(input.ids),
  }));

/** `Download/error.log` (the last 1 MB at most, `truncated` says so); empty when there is none. */
export const getErrorLog = os.handler(() => readErrorLog());

/** Deletes `Download/error.log`; a missing file is fine. */
export const clearErrorLog = os.handler(async () => {
  await clearLog();
});
