import { mkdirSync } from "node:fs";

const AppDirs = [
  "Sync",
  "UnSyncable",
  "Download",
  "media/Videos/.covers",
  "media/Videos/.captions",
  "media/Images/.covers",
  "media/Audios",
  "media/Texts",
  "media/Galleries",
  "webSync",
  "DB",
];

export default function createAppDirs() {
  for (const dir of AppDirs) {
    mkdirSync(dir, { recursive: true });
  }
}
