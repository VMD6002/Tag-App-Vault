export const TMP_DIR = "./tmp";
export const COMPLETED_DIR = "../Sync";
export const QUEUE_FILE = "tmp.json";
export const ERROR_LOG = "./error.log";
export const CONFIG_FILE = "config.json";

/** `<safe title>.<id>`: strips characters that break paths or yt-dlp's `%` templates. */
export const fileBase = (title: string, id: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional removal of control characters from file names
  `${title.replace(/[\\/:*?"<>|%\x00-\x1f]/g, "_").trim()}.${id}`;
