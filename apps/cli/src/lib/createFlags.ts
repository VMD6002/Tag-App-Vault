import { existsSync } from "node:fs";
import { TMP_DIR, fileBase } from "./constants";
import { downloadContent } from "./downloadContent";
import { getImageExtensionFromURL } from "./getImageExtensionFromURL";
import type { ContentWebType } from "@tagapp/utils/types";

const DEFAULT_FLAGS = ["--embed-thumbnail", "-R", "3"];

// Splits on whitespace but keeps quoted values (with spaces) intact.
const tokenize = (s: string) =>
  Array.from(
    s.matchAll(/"([^"]*)"|'([^']*)'|\S+/g),
    (m) => m[1] ?? m[2] ?? m[0],
  );

export async function createFlag(item: ContentWebType): Promise<string[]> {
  const base = fileBase(item.title, item.id);
  const flags = [
    item.url,
    "-o",
    `${TMP_DIR}/${base}.%(ext)s`,
    ...DEFAULT_FLAGS,
  ];

  if (item.download?.flags) flags.push(...tokenize(item.download.flags.value));

  if (item.tags.includes("meta:yt-cookie")) {
    const site = item.tags
      .find((t) => t.startsWith("Site:"))
      ?.slice("Site:".length);
    if (!site) throw new Error("No site tag found for cookies");
    const cookies = `./cookies/${site}.txt`;
    if (!existsSync(cookies))
      throw new Error(`No cookies file found for site ${site}`);
    flags.push("--cookies", cookies);
  }

  if (item.tags.includes("meta:different-cover")) {
    if (!item.cover) throw new Error("No cover found");
    await downloadContent(
      item.cover,
      `${TMP_DIR}/cover.${base}.${getImageExtensionFromURL(item.cover)}`,
    );
  } else {
    flags.push(
      "--write-thumbnail",
      "-o",
      `thumbnail:${TMP_DIR}/cover.${base}.%(ext)s`,
    );
  }

  return flags;
}
