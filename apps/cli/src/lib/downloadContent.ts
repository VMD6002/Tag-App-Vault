import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { USER_AGENT } from "./constants";

export async function downloadContent(url: string, filePath: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok || !response.body) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`,
    );
  }
  // Stream to disk instead of buffering the whole file in memory.
  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(filePath),
  );
}
