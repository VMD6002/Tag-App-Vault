import { existsSync } from "node:fs";
import { TMP_DIR } from "./constants";
import { downloadContent } from "./downloadContent";
import { getImageExtensionFromURL } from "./getImageExtensionFromURL";
import type { ContentWebType, preset } from "@tagapp/utils/types";

const DEFAULT_FLAGS = ["--embed-thumbnail", "-R", "3"];

export async function createFlag(item: ContentWebType): Promise<string[]> {
  const flags = [
    item.url,
    "-o",
    `${TMP_DIR}/${item.title}.${item.id}.%(ext)s`,
    ...DEFAULT_FLAGS,
  ];

  if (item.download?.flags) {
    const preset = item.download.flags as preset;
    flags.push(...preset.value.replace(/"|' /g, "").split(" "));

    if (item.tags.includes("Util:Cookies")) {
      const siteTag = item.tags.find((tag) => tag.startsWith("Site:"));
      if (!siteTag) {
        throw new Error("No site tag found for cookies");
      }

      const siteName = siteTag.split(":")[1];
      if (!existsSync(`./cookies/${siteName}.txt`)) {
        throw new Error(`No cookies file found for site ${siteName}`);
      }
      flags.push("--cookies", `./cookies/${siteName}.txt`);
    }
  }

  if (!item.tags.includes("Util:Different_Cover")) {
    flags.push(
      "--write-thumbnail",
      "-o",
      `thumbnail:${TMP_DIR}/cover.${item.title}.${item.id}.%(ext)s`,
    );
  } else {
    if (!item.cover) {
      throw new Error("No cover found");
    }
    const ext = getImageExtensionFromURL(item.cover);
    await downloadContent(
      item.cover,
      `${TMP_DIR}/cover.${item.title}.${item.id}.${ext}`,
    );
  }

  return flags;
}
