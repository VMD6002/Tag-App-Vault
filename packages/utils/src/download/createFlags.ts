import type { ContentWebType } from "@tagapp/utils/types";
import { DIFFERENT_COVER_TAG, YT_COOKIE_TAG } from "../reservedTags";
import { downloadContent } from "./downloadContent";
import { fileBase } from "./files";
import { getImageExtensionFromURL } from "./getImageExtensionFromURL";

// --continue + --no-overwrites: resume .part files from a previous run, skip finished files.
const DEFAULT_FLAGS = [
  "--embed-thumbnail",
  "-R",
  "3",
  "--continue",
  "--no-overwrites",
];
// Item flags that would defeat resuming.
const BLOCKED_FLAGS = new Set(["--no-part", "--no-continue"]);

// Splits on whitespace but keeps quoted values (with spaces) intact.
const tokenize = (s: string) =>
  Array.from(
    s.matchAll(/"([^"]*)"|'([^']*)'|\S+/g),
    (m) => m[1] ?? m[2] ?? m[0],
  );

export async function createFlag(
  item: ContentWebType,
  userAgent: string,
  /** Where yt-dlp writes, and where `meta:yt-cookie` looks for `<Site>.txt`. */
  { tmpDir, cookiesDir }: { tmpDir: string; cookiesDir: string },
): Promise<string[]> {
  const base = fileBase(item.title, item.id);
  const flags = [item.url, "-o", `${tmpDir}/${base}.%(ext)s`, ...DEFAULT_FLAGS];

  const itemFlags = item.download?.flags
    ? tokenize(item.download.flags.value).filter((t) => !BLOCKED_FLAGS.has(t))
    : [];
  flags.push(...itemFlags);
  if (
    !itemFlags.some(
      (t) => t === "--user-agent" || t.startsWith("--user-agent="),
    )
  )
    flags.push("--user-agent", userAgent);

  if (item.tags.includes(YT_COOKIE_TAG)) {
    const site = item.tags
      .find((t) => t.startsWith("Site:"))
      ?.slice("Site:".length);
    if (!site) throw new Error("No site tag found for cookies");
    const cookies = `${cookiesDir}/${site}.txt`;
    if (!(await Bun.file(cookies).exists()))
      throw new Error(`No cookies file found for site ${site}`);
    flags.push("--cookies", cookies);
  }

  if (item.tags.includes(DIFFERENT_COVER_TAG)) {
    if (!item.cover) throw new Error("No cover found");
    await downloadContent(
      item.cover,
      `${tmpDir}/cover.${base}.${getImageExtensionFromURL(item.cover)}`,
      userAgent,
    );
  } else {
    flags.push(
      "--write-thumbnail",
      "-o",
      `thumbnail:${tmpDir}/cover.${base}.%(ext)s`,
    );
  }

  return flags;
}
