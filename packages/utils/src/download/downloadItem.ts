import PQueue from "p-queue";
import type YTDlpWrap from "yt-dlp-wrap-plus";
import type { ContentWebType } from "../types/web";
import type { Config } from "./config";
import { createFlag } from "./createFlags";
import { downloadContent } from "./downloadContent";
import { fileBase } from "./files";
import { getImageExtensionFromURL } from "./getImageExtensionFromURL";

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadEnv {
  config: Pick<Config, "userAgent">;
  /** Scratch dir for in-flight and finished files; never cleared. */
  tmpDir: string;
  cookiesDir: string;
  ytDlp: Pick<YTDlpWrap, "exec">;
}

/** Downloads one queue item into `env.tmpDir`: `fetch` for `direct`, yt-dlp otherwise. Throws on failure. */
export async function downloadItem(
  item: ContentWebType,
  { config, tmpDir, cookiesDir, ytDlp }: DownloadEnv,
  onProgress: (p: Partial<DownloadProgress>) => void,
) {
  if (item.download?.type === "direct") {
    if (!item.cover || !item.contentUrl)
      throw new Error("Missing URLs for direct download");
    const base = fileBase(item.title, item.id);

    onProgress({ percent: 10, speed: "Fetch", eta: "Cover" });
    await downloadContent(
      item.cover,
      `${tmpDir}/cover.${base}.${getImageExtensionFromURL(item.cover)}`,
      config.userAgent,
    );

    onProgress({ percent: 50, speed: "Fetch", eta: "Content" });
    await downloadContent(
      item.contentUrl,
      `${tmpDir}/${base}.${getImageExtensionFromURL(item.contentUrl)}`,
      config.userAgent,
    );
    return;
  }

  const flags = await createFlag(item, config.userAgent, {
    tmpDir,
    cookiesDir,
  });
  await new Promise<void>((resolve, reject) => {
    ytDlp
      .exec(flags)
      .on("progress", (p) =>
        onProgress({
          percent: p.percent ?? 0,
          speed: p.currentSpeed ?? "0B/s",
          eta: p.eta ?? "--:--",
        }),
      )
      .on("error", reject)
      // A null code means the process was killed by a signal: that's a failure too.
      .on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`yt-dlp exited with code ${code}`)),
      );
  });
}

/** 1 concurrent download per scraper, max 3 overall. Create a fresh one for every run. */
export function createEnqueue() {
  const scraperQueues = new Map<string, PQueue>();
  const globalThrottle = new PQueue({ concurrency: 3 });
  return (scraper: string, task: () => Promise<void>) => {
    let queue = scraperQueues.get(scraper);
    if (!queue) {
      queue = new PQueue({ concurrency: 1 });
      scraperQueues.set(scraper, queue);
    }
    return queue.add(() => globalThrottle.add(task));
  };
}
