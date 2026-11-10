# Server downloads

Scope: the download manager inside the server (`packages/api/src/services/downloads.ts`, router `routers/downloads.ts`): it runs the queue in the server process and imports every finished item straight into the library, with no visit to `Sync/`. The CLI does the same download work for headless use: [download CLI](./download-cli.md). The sync stages it reuses: [sync pipeline](./sync-pipeline.md).

## Flow

1. `POST /downloads/set` (or hand-edited `Download/tmp.json`) holds the queue. `downloads.start` starts a run.
2. Per item (one per `scraper`, three overall, `createEnqueue`): `downloadItem` (shared with the CLI: `fetch` for `direct`, yt-dlp otherwise) into `Download/tmp`, then `moveFinished` moves the files and `<title>.<id>.json` into the staging folder `Download/done/<id>/`.
3. Import: `syncContent("./Download/done/<id>")` (so `withSyncLock`, covers, caption pairing, metadata validation, tag counts, rollback: all of [sync pipeline](./sync-pipeline.md#synccontent-servicessynccontentts)). Success means the id is in `contentDataDB`.
4. On success the item leaves `tmp.json` and its (now empty) staging folder is removed. Only then is the task `completed`.

Shared helpers (`packages/utils/src/download`, entry `@tagapp/utils/download`, server-side only): `fileBase`, `safeTitle`, `createFlag`, `downloadContent`, `getImageExtensionFromURL`, `loadConfig`, `downloadItem`, `createEnqueue`, `moveFinished`. All paths are parameters; the server uses `./Download/...`, the CLI its cwd. yt-dlp is passed in (`ytDlp`), which is how tests fake it.

## Files (all under `Download/`)

| Path                 | Use                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tmp.json`           | The queue. Written atomically (temp file + rename); every write goes through one lock                        |
| `config.json`        | `userAgent` (and the CLI's `retryDelayMinutes`); created with defaults on the first run, read at every start |
| `cookies/<Site>.txt` | yt-dlp cookies for `meta:yt-cookie` items                                                                    |
| `tmp/`               | In-flight and partial downloads, never cleared (yt-dlp resumes from them)                                    |
| `done/<id>/`         | Staging per item: finished files plus sidecar until imported                                                 |
| `error.log`          | Failures appended: `[title]: message` plus stack                                                             |

## Failure handling

- A failed item stays in `tmp.json`, its task is `failed` with `error`, and the message goes to `error.log`.
- Files are never dropped: a failed import (duplicate id, invalid metadata, failed move, DB write error) leaves them in `Download/done/<id>/` (the sync rollback moves them back there). Files with an unsupported extension go to `UnSyncable/`, as in `Sync/`.
- The next run of a failed item with a staging folder skips the download and retries the import (fix the sidecar JSON by hand, or free the id, first). Delete the folder to force a new download.
- The sidecar title is made file-safe (`safeTitle`: `\ / : * ? " < > | %` become `_`) so it matches the file names; `prepareSync` renames to `<title>.<id>` from the JSON title and would fail on `/`. The queue entry keeps the original title.
- An id containing `/` or `\`, or equal to `.` / `..`, fails at once (it becomes a folder name).
- A download that exits 0 but leaves no files for the id fails ("produced no files") and leaves no sidecar.
- A missing `tmp.json` is an empty queue; invalid JSON makes `getQueue` / `start` throw (server error).

## Queue and `POST /downloads/set` during a run

- A run works on the queue it started with. Items posted later wait for the next `start`; nothing starts by itself.
- `set` while a run is active keeps every item whose task is `queued`, `downloading` or `importing` exactly as it is (never dropped), and ignores a posted copy of the same id; the rest is replaced by what was posted. Idle: it just writes the posted list. Either way ids are de-duplicated (first wins) and the written list is returned.
- Completed items are already gone from the queue; posting one again re-queues it (it then fails as "already in the library" unless it was deleted).
- There is no cancel. A server restart loses the task state, not the queue: partial files in `tmp/` resume, staged items retry their import.

## oRPC procedures (`downloads`)

| Procedure  | Input | Output                                                                                      |
| ---------- | ----- | ------------------------------------------------------------------------------------------- |
| `getQueue` | none  | `ContentWebType[]`: the current `tmp.json` items (also those of a finished run that failed) |
| `start`    | none  | `{ started: boolean }`: false when a run is already going or the queue is empty             |
| `watch`    | none  | event stream (`text/event-stream` via oRPC event iterator) of `DownloadsSnapshot`           |

```ts
type DownloadsSnapshot = {
  running: boolean;
  tasks: {
    id: string;
    title: string;
    scraper: string;
    status: "queued" | "downloading" | "importing" | "completed" | "failed";
    percent: number; // 0-100
    speed: string; // "1.2MiB/s", "Fetch" for direct downloads
    eta: string; // "00:12", "--:--"
    error?: string; // when failed
  }[];
};
```

- `watch` yields a full snapshot at once (even when idle: `{running:false,tasks:[]}` before any run), then a new full snapshot after changes. Status changes are sent immediately; progress ticks are coalesced to at most 4 per second. Snapshots may repeat the same state. It ends when the client aborts (the handler's `signal`).
- `tasks` keep the last run's items (completed and failed) until the next run replaces them. When a task completes or fails, refetch `getQueue` for the remaining queue.
- Streaming was checked end to end, also through the repo's Caddyfile (`encode zstd gzip` + `reverse_proxy`, client sending `Accept-Encoding: gzip, zstd`): `logger`, `trimTrailingSlash`, CORS and the `/rpc/*` handler do not buffer it, and oRPC sends a `: ` keep-alive comment every 5 s, under Bun's 10 s idle timeout. The web client needs oRPC's fetch link to consume the iterator (`for await`).

## CLI side effects to know

The CLI (`apps/cli`) and the server run the same queue file and `Download/tmp`. Nothing stops both at once; do not run them together on the same `Download/`.

## Tests

`packages/api/src/services/sync.test.ts` ("download:" tests) drives `startDownloads` with a fake yt-dlp: item lands in `media/` + DB + tag counts and leaves the queue, a duplicate id stays staged and retries without downloading, `setQueue` during a run. `packages/utils/src/download/*.test.ts`: config and `fetch` retries. No network, no real yt-dlp.
