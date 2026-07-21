import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import {
  readdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from "node:fs";
import PQueue from "p-queue";

import type YTDlpWrap from "yt-dlp-wrap-plus";
const { default: YTDlpWrapRuntime } = require("yt-dlp-wrap-plus");

import { TMP_DIR, COMPLETED_DIR } from "./lib/constants";
import { createFlag } from "./lib/createFlags";
import { downloadContent } from "./lib/downloadContent";
import { getImageExtensionFromURL } from "./lib/getImageExtensionFromURL";
import type { ContentWebType } from "@tagapp/utils/types";

mkdirSync("tmp", { recursive: true });
mkdirSync("../Sync", { recursive: true });

// 1. Initial Data & Wrapper Setup
const downloadData: ContentWebType[] = JSON.parse(
  readFileSync("tmp.json", "utf-8"),
);
const ytDlp: YTDlpWrap = new YTDlpWrapRuntime();

// 2. Queue Configuration (1 per scraper, max 3 overall)
const scraperQueues = new Map<string, PQueue>();
const globalThrottle = new PQueue({ concurrency: 3 });

function enqueueTask(scraper: string, taskFn: () => Promise<void>) {
  if (!scraperQueues.has(scraper)) {
    scraperQueues.set(scraper, new PQueue({ concurrency: 1 }));
  }
  return scraperQueues.get(scraper)!.add(() => globalThrottle.add(taskFn));
}

interface TaskState {
  id: string;
  title: string;
  scraper: string;
  status: "queued" | "downloading" | "completed" | "failed";
  percent: number;
  speed: string;
  eta: string;
}

// 3. Main Dashboard UI Component
function App() {
  const [tasks, setTasks] = useState<TaskState[]>(() =>
    downloadData.map((item) => ({
      id: item.id,
      title: item.title,
      scraper: item.scraper,
      status: "queued",
      percent: 0,
      speed: "0B/s",
      eta: "--:--",
    })),
  );

  // Helper helper to update state fields cleanly for a specific index
  const updateTask = (index: number, fields: Partial<TaskState>) => {
    setTasks((prev) => {
      const updated = [...prev];
      // By using Object.assign or explicitly structuring, we appease the compiler
      updated[index] = Object.assign({}, updated[index], fields);
      return updated;
    });
  };

  const moveFilesToCompleted = (
    itemId: string,
    itemTitle: string,
    originalItem: ContentWebType,
  ) => {
    const files = readdirSync(TMP_DIR);
    for (const file of files) {
      if (file.includes(itemId)) {
        renameSync(`${TMP_DIR}/${file}`, `${COMPLETED_DIR}/${file}`);
      }
    }
    writeFileSync(
      `${COMPLETED_DIR}/${itemTitle}.${itemId}.json`,
      JSON.stringify(originalItem, null, 2),
    );

    const currentJson = JSON.parse(
      readFileSync("tmp.json", "utf-8"),
    ) as ContentWebType[];
    const nextJson = currentJson.filter((i) => i.id !== itemId);
    writeFileSync("tmp.json", JSON.stringify(nextJson, null, 2));
  };

  async function processTask(item: ContentWebType, index: number) {
    updateTask(index, { status: "downloading" });

    try {
      if (item.download?.type === "curl") {
        if (!item.cover || !item.contentUrl)
          throw new Error("Missing URLs for curl download");

        updateTask(index, { percent: 10, speed: "Fetch", eta: "Cover" });
        const coverExt = getImageExtensionFromURL(item.cover);
        await downloadContent(
          item.cover,
          `${TMP_DIR}/cover.${item.title}.${item.id}.${coverExt}`,
        );

        updateTask(index, { percent: 50, speed: "Fetch", eta: "Content" });
        const imgExt = getImageExtensionFromURL(item.contentUrl);
        await downloadContent(
          item.contentUrl,
          `${TMP_DIR}/${item.title}.${item.id}.${imgExt}`,
        );

        updateTask(index, { percent: 100, speed: "0B/s", eta: "00:00" });
      } else {
        const flags = await createFlag(item);

        await new Promise<void>((resolve, reject) => {
          ytDlp
            .exec(flags)
            .on("progress", (progress) => {
              updateTask(index, {
                percent: progress.percent ?? 0,
                speed: progress.currentSpeed ?? "0B/s",
                eta: progress.eta ?? "--:--",
              });
            })
            .on("error", (err) => reject(err))
            .on("close", (code) => {
              if (code !== 0 && code !== null)
                reject(new Error(`Exit code ${code}`));
              else resolve();
            });
        });
      }

      moveFilesToCompleted(item.id, item.title, item);
      updateTask(index, { status: "completed" });
    } catch (error: any) {
      updateTask(index, { status: "failed" });
      writeFileSync(
        `./error.log`,
        `[${item.title}]: ${error.message || "Unknown error"}\n${error.stack || ""}\n`,
        {
          flag: "a",
        },
      );
    }
  }

  // Trigger tasks exactly once when the component mounts
  useEffect(() => {
    downloadData.forEach((item, index) => {
      enqueueTask(item.scraper, () => processTask(item, index));
    });
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        🚀 INK + MULTI-ENGINE PARALLEL DOWNLOADER
      </Text>
      <Text color="gray">
        -----------------------------------------------------
      </Text>
      <Box height={1} />

      <Box flexDirection="column">
        {tasks.map((task) => (
          <Box flexDirection="column" marginBottom={1} key={task.id}>
            <Box flexDirection="row">
              <Text color="magenta" bold>
                [{task.scraper}]{" "}
              </Text>
              <Text color="white">{task.title}</Text>
            </Box>
            <Box paddingLeft={2}>
              {task.status === "downloading" && (
                <Text color="green">
                  ⏳ Progress: {task.percent.toFixed(1)}% | Speed: {task.speed}{" "}
                  | ETA: {task.eta}
                </Text>
              )}
              {task.status === "queued" && (
                <Text color="gray">
                  💤 Waiting for scraper sequence channel...
                </Text>
              )}
              {task.status === "completed" && (
                <Text color="green">✔ Success</Text>
              )}
              {task.status === "failed" && (
                <Text color="red">✖ Encountered Download Failure</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

render(<App />);
