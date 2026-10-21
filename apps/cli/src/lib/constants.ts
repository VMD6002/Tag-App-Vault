export const TMP_DIR = "./tmp";
export const COMPLETED_DIR = "../Sync";
export const QUEUE_FILE = "tmp.json";
export const ERROR_LOG = "./error.log";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

/** `<safe title>.<id>`: strips characters that break paths or yt-dlp's `%` templates. */
export const fileBase = (title: string, id: string) =>
  `${title.replace(/[\\/:*?"<>|%\x00-\x1f]/g, "_").trim()}.${id}`;
