import { existsSync, renameSync } from "node:fs";

export async function downloadContent(
  url: string,
  filePath: string,
  userAgent: string,
) {
  // shortcut: a finished file from a previous run is trusted and no HTTP range resume of partial files, upgrade if big curl downloads need resuming.
  if (existsSync(filePath)) return;
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`,
    );
  }
  // Streams to disk instead of buffering the whole file in memory. Written to
  // `.part` first so an interrupted download is never mistaken for a finished one.
  await Bun.write(`${filePath}.part`, response);
  renameSync(`${filePath}.part`, filePath);
}
