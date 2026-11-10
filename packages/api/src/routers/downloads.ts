import { os } from "@orpc/server";
import {
  readQueue,
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
