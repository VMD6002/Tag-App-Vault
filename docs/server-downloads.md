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
| `error.log`          | Failures appended: `[title]: message` plus stack; read and cleared from the web ([Error log](#error-log))    |

## Failure handling

- A failed item stays in `tmp.json`, its task is `failed` with `error`, and the message goes to `error.log`. Drop it with `downloads.remove` (the "Clear failed" button) instead of editing `tmp.json`.
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
- A server restart loses the task state, not the queue: partial files in `tmp/` resume, staged items retry their import.

## Cancel and remove

- `downloads.cancel` (`cancelDownloads`): with `id`, stops that item if its task is `queued` or `downloading`; without, every such item of the run. The task becomes `cancelled` at once, the item's `AbortController` fires (yt-dlp is killed through `ytDlp.exec(flags, undefined, signal)`, `fetch` aborts in `downloadContent`), items still waiting in the p-queue return as soon as their turn comes without starting, and the run ends normally (`running` goes false). A cancelled item stays in `tmp.json` (the next `start` runs it again, resuming from the partial files in `tmp/`) and is not written to `error.log`. Returns `{ cancelled: n }`; an unknown, finished or `importing` id cancels nothing (`importing` runs under `withSyncLock` and is atomic per item, so it always finishes).
- `downloads.remove` (`removeDownloads`, input `{ ids }`, ids validated like the staging folder name): runs under `withSyncLock`. Any id whose task is `queued`/`downloading`/`importing` refuses the whole call with CONFLICT (cancel it first), so there is no partial removal. Then, per id: files in `Download/done/<id>/` (a failed import) move to `Sync/` so they can be fixed on the `/sync` page; a name already in `Sync/` is a CONFLICT and nothing moves; a failure while moving or writing the queue renames everything back. The item leaves `tmp.json`, the empty staging folder is removed, its task state leaves the snapshot (watchers are notified) and incomplete downloads of the id in `tmp/` (`<title>.<id>.<ext>.part`, `.part-FragN`, `.ytdl`, `.temp`; matched on the exact id so other items' files are safe) are deleted. Finished files in `tmp/` are never deleted. Returns `{ removed }`: the ids that were in the queue.
- Known limit: a `start` issued while a `remove` of the same item is in flight can still pick the item up (the window is a few ms); the web page disables nothing for this.

## Error log

- `Download/error.log` (`ERROR_LOG` in `services/downloads.ts`, also the CLI's `./error.log` when run from `Download/`) holds one `[title]: message` plus stack block per failed item. Cancels are not logged. Nothing trims it.
- `downloads.getErrorLog` (`readErrorLog`) returns `{ text, truncated }`: a missing file is `""`; a file over 1 MB (`ERROR_LOG_MAX`) returns only its last 1 MB, starting at a whole line, with `truncated: true`. `downloads.clearErrorLog` (`clearErrorLog`) deletes the file (a missing file is fine). Failed items stay in the queue; only their log entries go. Clearing is not locked against an append in the same instant.
- Other server errors (`errorLog()` in `lib/errorLog.ts`, route failures, sync) go to the console only and are not in this file or the web page.

## oRPC procedures (`downloads`)

| Procedure       | Input               | Output                                                                                      |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `getQueue`      | none                | `ContentWebType[]`: the current `tmp.json` items (also those of a finished run that failed) |
| `start`         | none                | `{ started: boolean }`: false when a run is already going or the queue is empty             |
| `cancel`        | `{ id?: string }`   | `{ cancelled: number }`: see [Cancel and remove](#cancel-and-remove)                        |
| `remove`        | `{ ids: string[] }` | `{ removed: string[] }`: drops items from the queue, staged files go to `Sync/`             |
| `getErrorLog`   | none                | `{ text: string, truncated: boolean }`: the tail of `Download/error.log`                    |
| `clearErrorLog` | none                | nothing: deletes `Download/error.log`                                                       |
| `watch`         | none                | event stream (`text/event-stream` via oRPC event iterator) of `DownloadsSnapshot`           |

```ts
type DownloadsSnapshot = {
  running: boolean;
  tasks: {
    id: string;
    title: string;
    scraper: string;
    status:
      | "queued"
      | "downloading"
      | "importing"
      | "completed"
      | "failed"
      | "cancelled";
    percent: number; // 0-100
    speed: string; // "1.2MiB/s", "Fetch" for direct downloads
    eta: string; // "00:12", "--:--"
    error?: string; // when failed
  }[];
};
```

- `watch` yields a full snapshot at once (even when idle: `{running:false,tasks:[]}` before any run), then a new full snapshot after changes. Status changes are sent immediately; progress ticks are coalesced to at most 4 per second. Snapshots may repeat the same state. It ends when the client aborts (the handler's `signal`).
- `tasks` keep the last run's items (completed and failed) until the next run replaces them. When a task completes or fails, refetch `getQueue` for the remaining queue.
- Streaming was checked end to end, also through the repo's Caddyfile (`encode zstd gzip` + `reverse_proxy`, client sending `Accept-Encoding: gzip, zstd`): `logger`, `trimTrailingSlash`, CORS and the `/rpc/*` handler do not buffer it, and oRPC sends a `: ` keep-alive comment every 5 s, under Bun's 10 s idle timeout. The web client needs oRPC's fetch link to consume the iterator; the `/downloads` page does ([web app](./web-app.md#state)). `DownloadsSnapshot` and `DownloadTask` are re-exported (types only) from `@tagapp/api`.

## CLI side effects to know

The CLI (`apps/cli`) and the server run the same queue file and `Download/tmp`. Nothing stops both at once; do not run them together on the same `Download/`.

## Tests

`packages/api/src/services/sync.test.ts` ("download:" tests) drives `startDownloads` with a fake yt-dlp: item lands in `media/` + DB + tag counts and leaves the queue, a duplicate id stays staged and retries without downloading, `setQueue` during a run. Cancel (a hung fake yt-dlp that closes with a null code on abort: the run ends, waiting items never start, nothing in `error.log`, items stay queued and run again) and remove (staged files to `Sync/`, active item refused, name clash is CONFLICT and moves nothing, partial downloads of the id deleted) are tested there too. `packages/utils/src/download/*.test.ts`: config, `fetch` retries and abort. The error log procedures (missing file, normal, over the cap, clear) have one test at the end of `sync.test.ts`. No network, no real yt-dlp.
