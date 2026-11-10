import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { Box, render, Text, useApp } from "ink";
import PQueue from "p-queue";
import { useEffect, useState } from "react";

import type YTDlpWrap from "yt-dlp-wrap-plus";

const { default: YTDlpWrapRuntime } = require("yt-dlp-wrap-plus");

import type { ContentWebType } from "@tagapp/utils/types";
import { parseArgs, USAGE } from "./lib/args";
import { type Config, loadConfig } from "./lib/config";
import {
  COMPLETED_DIR,
  ERROR_LOG,
  fileBase,
  QUEUE_FILE,
  TMP_DIR,
} from "./lib/constants";
import { createFlag } from "./lib/createFlags";
import { downloadContent } from "./lib/downloadContent";
import { getImageExtensionFromURL } from "./lib/getImageExtensionFromURL";

const readQueue = (): ContentWebType[] =>
  JSON.parse(readFileSync(QUEUE_FILE, "utf-8"));
const ytDlp: YTDlpWrap = new YTDlpWrapRuntime();

// 1 concurrent download per scraper, max 3 overall. Fresh queues for every run.
function createEnqueue() {
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

type Status = "queued" | "downloading" | "completed" | "failed";
interface TaskState {
  id: string;
  title: string;
  scraper: string;
  status: Status;
  percent: number;
  speed: string;
  eta: string;
}

function moveFilesToCompleted(item: ContentWebType) {
  const base = fileBase(item.title, item.id);
  for (const file of readdirSync(TMP_DIR)) {
    // Match ".<id>." so one id can't match a longer id that contains it.
    // Skip yt-dlp / partial-download leftovers: they stay in ./tmp so the next run can resume.
    if (/\.(part(-Frag\d+)?|ytdl|temp)$/.test(file)) continue;
    if (file.includes(`.${item.id}.`)) {
      renameSync(`${TMP_DIR}/${file}`, `${COMPLETED_DIR}/${file}`);
    }
  }
  writeFileSync(`${COMPLETED_DIR}/${base}.json`, JSON.stringify(item, null, 2));
  writeFileSync(
    QUEUE_FILE,
    JSON.stringify(
      readQueue().filter((i) => i.id !== item.id),
      null,
      2,
    ),
  );
}

function App({
  downloadData,
  config,
  enqueueTask,
}: {
  downloadData: ContentWebType[];
  config: Config;
  enqueueTask: ReturnType<typeof createEnqueue>;
}) {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<TaskState[]>(() =>
    downloadData.map(({ id, title, scraper }) => ({
      id,
      title,
      scraper,
      status: "queued",
      percent: 0,
      speed: "0B/s",
      eta: "--:--",
    })),
  );

  const updateTask = (index: number, fields: Partial<TaskState>) =>
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...fields } : t)),
    );

  async function processTask(item: ContentWebType, index: number) {
    updateTask(index, { status: "downloading" });
    try {
      if (item.download?.type === "direct") {
        if (!item.cover || !item.contentUrl)
          throw new Error("Missing URLs for direct download");
        const base = fileBase(item.title, item.id);

        updateTask(index, { percent: 10, speed: "Fetch", eta: "Cover" });
        await downloadContent(
          item.cover,
          `${TMP_DIR}/cover.${base}.${getImageExtensionFromURL(item.cover)}`,
          config.userAgent,
        );

        updateTask(index, { percent: 50, speed: "Fetch", eta: "Content" });
        await downloadContent(
          item.contentUrl,
          `${TMP_DIR}/${base}.${getImageExtensionFromURL(item.contentUrl)}`,
          config.userAgent,
        );
      } else {
        const flags = await createFlag(item, config.userAgent);
        await new Promise<void>((resolve, reject) => {
          ytDlp
            .exec(flags)
            .on("progress", (p) =>
              updateTask(index, {
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

      moveFilesToCompleted(item);
      updateTask(index, {
        status: "completed",
        percent: 100,
        speed: "0B/s",
        eta: "00:00",
      });
    } catch (error) {
      const err = error as Error | undefined;
      updateTask(index, { status: "failed" });
      appendFileSync(
        ERROR_LOG,
        `[${item.title}]: ${err?.message ?? "Unknown error"}\n${err?.stack ?? ""}\n`,
      );
    }
  }

  // Runs once on mount: enqueues every download; re-running would enqueue them again
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only enqueue, see above
  useEffect(() => {
    downloadData.forEach((item, i) => {
      enqueueTask(item.scraper, () => processTask(item, i));
    });
  }, []);

  // Let the process exit once everything has finished (otherwise Ink keeps it alive).
  useEffect(() => {
    if (tasks.every((t) => t.status === "completed" || t.status === "failed"))
      exit();
  }, [tasks, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        🚀 INK + MULTI-ENGINE PARALLEL DOWNLOADER
      </Text>
      <Text color="gray">
        -----------------------------------------------------
      </Text>
      <Box height={1} />
      {tasks.map((t) => (
        <Box flexDirection="column" marginBottom={1} key={t.id}>
          <Box>
            <Text color="magenta" bold>
              [{t.scraper}]{" "}
            </Text>
            <Text color="white">{t.title}</Text>
          </Box>
          <Box paddingLeft={2}>
            {t.status === "downloading" && (
              <Text color="green">
                ⏳ Progress: {t.percent.toFixed(1)}% | Speed: {t.speed} | ETA:{" "}
                {t.eta}
              </Text>
            )}
            {t.status === "queued" && (
              <Text color="gray">
                💤 Waiting for scraper sequence channel...
              </Text>
            )}
            {t.status === "completed" && <Text color="green">✔ Success</Text>}
            {t.status === "failed" && (
              <Text color="red">
                ✖ Encountered Download Failure (see {ERROR_LOG})
              </Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

async function main() {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    process.exit(1);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }

  let config: Config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  // ./tmp is never cleared: leftovers let the next run resume partial downloads.
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(COMPLETED_DIR, { recursive: true });

  for (let attempt = 0; ; attempt++) {
    const instance = render(
      <App
        downloadData={readQueue()}
        config={config}
        enqueueTask={createEnqueue()}
      />,
    );
    await instance.waitUntilExit();

    // Items that failed are still in tmp.json.
    if (readQueue().length === 0 || attempt >= args.retries) break;
    const of = Number.isFinite(args.retries) ? `/${args.retries}` : "";
    console.log(
      `Retrying in ${config.retryDelayMinutes} min (attempt ${attempt + 1}${of})...`,
    );
    await Bun.sleep(config.retryDelayMinutes * 60_000);
  }
}

await main();
