import { existsSync, renameSync } from "node:fs";

const ATTEMPTS = 3;

/** Thrown for HTTP errors that won't fix themselves (4xx except 429). */
class PermanentError extends Error {}

export async function downloadContent(
  url: string,
  filePath: string,
  userAgent: string,
  baseDelayMs = 2000,
  /** Aborts the request (and the retries); the `.part` file stays and is overwritten next time. */
  signal?: AbortSignal,
) {
  // shortcut: a finished file from a previous run is trusted and no HTTP range resume of partial files, upgrade if big direct downloads need resuming.
  if (existsSync(filePath)) return;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal,
      });
      if (!response.ok) {
        const msg = `HTTP ${response.status}: ${response.statusText} for ${url}`;
        const retryable = response.status === 429 || response.status >= 500;
        throw retryable ? new Error(msg) : new PermanentError(msg);
      }
      // Streams to disk instead of buffering the whole file in memory. Written to
      // `.part` first so an interrupted download is never mistaken for a finished one.
      await Bun.write(`${filePath}.part`, response);
      renameSync(`${filePath}.part`, filePath);
      return;
    } catch (e) {
      // Network errors, 429 and 5xx are retried with backoff (2s, 4s, ...); the CLI's --retry covers longer outages.
      if (signal?.aborted || e instanceof PermanentError || attempt >= ATTEMPTS)
        throw e;
      await Bun.sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
