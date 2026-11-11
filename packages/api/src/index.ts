import * as audio from "./routers/audio.js";
import * as downloads from "./routers/downloads.js";
import * as fix from "./routers/fix.js";
import * as gallery from "./routers/gallery.js";
import * as groups from "./routers/groups.js";
import * as main from "./routers/main.js";
import * as text from "./routers/text.js";
import * as video from "./routers/video.js";

export const router = {
  fix,
  main,
  video,
  gallery,
  text,
  audio,
  downloads,
  groups,
};

export { groupsDB } from "./db/groups.js";
export { settingsDB } from "./db/settings.js";
export type {
  DownloadsSnapshot,
  DownloadTask,
} from "./services/downloads.js";
export {
  downloadsSetSchema,
  setDownloads,
  setQueue,
} from "./services/downloads.js";

export type router = typeof router;
