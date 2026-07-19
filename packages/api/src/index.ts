import * as fix from "./routers/fix.js";
import * as main from "./routers/main.js";
import * as gallery from "./routers/gallery.js";
import * as text from "./routers/text.js";
import * as audio from "./routers/audio.js";
import * as video from "./routers/video.js";
import { settingsDB } from "./db/settings.js";

export const router = {
  fix,
  main,
  video,
  gallery,
  text,
  audio,
};

export const settings = settingsDB.data;

export type router = typeof router;
