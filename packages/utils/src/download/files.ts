import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import type { ContentWebType } from "../types/web";

/** Replaces characters that break paths or yt-dlp's `%` templates. */
export const safeTitle = (title: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional removal of control characters from file names
  title.replace(/[\\/:*?"<>|%\x00-\x1f]/g, "_").trim();

/** `<safe title>.<id>` */
export const fileBase = (title: string, id: string) =>
  `${safeTitle(title)}.${id}`;

/**
 * Moves the finished files of `item` from `tmpDir` to `destDir` and writes the
 * `<title>.<id>.json` sidecar there (last, so it only exists once the files are in).
 * Returns the moved file names.
 */
export function moveFinished(
  item: ContentWebType,
  tmpDir: string,
  destDir: string,
) {
  mkdirSync(destDir, { recursive: true });
  const moved: string[] = [];
  for (const file of readdirSync(tmpDir)) {
    // Match ".<id>." so one id can't match a longer id that contains it.
    // Skip yt-dlp / partial-download leftovers: they stay in tmpDir so the next run can resume.
    if (/\.(part(-Frag\d+)?|ytdl|temp)$/.test(file)) continue;
    if (file.includes(`.${item.id}.`)) {
      renameSync(`${tmpDir}/${file}`, `${destDir}/${file}`);
      moved.push(file);
    }
  }
  writeFileSync(
    `${destDir}/${fileBase(item.title, item.id)}.json`,
    JSON.stringify(item, null, 2),
  );
  return moved;
}
