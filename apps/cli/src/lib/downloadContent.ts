import { USER_AGENT } from "./constants";

export async function downloadContent(url: string, filePath: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} for ${url}`,
    );
  }
  // Streams to disk instead of buffering the whole file in memory.
  await Bun.write(filePath, response);
}
