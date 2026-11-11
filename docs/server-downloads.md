# Server downloads

Scope: the download manager inside the server (`packages/api/src/services/downloads.ts`, router `routers/downloads.ts`): it runs the queue in the server process and imports every finished item straight into the library, with no visit to `Sync/`. The CLI does the same download work for headless use: [download CLI](./download-cli.md). The sync stages it reuses: [sync pipeline](./sync-pipeline.md).

## Flow

1. `POST /downloads/set` (or hand-edited `Download/tmp.json`) holds the queue. `downloads.start` starts a run.
2. Per item (one per `scraper`, three overall, `createEnqueue`): `downloadItem` (shared with the CLI: `fetch` for `direct`, yt-dlp otherwise) into `Download/tmp`, then `moveFinished` moves the files and `<title>.<id>.json` into the staging folder `Download/done/<id>/`.
3. Import: `syncContent("./Download/done/<id>")` (so `withSyncLock`, covers, caption pairing, metadata validation, tag counts, rollback: all of [sync pipeline](./sync-pipeline.md#synccontent-servicessynccontentts)). Success means the id is in `contentDataDB`.
4. On success the item leaves `tmp.json` and its (now empty) staging folder is removed. Only then is its record `completed` ([History](#history-and-the-snapshot)).

Shared helpers (`packages/utils/src/download`, entry `@tagapp/utils/download`, server-side only): `fileBase`, `safeTitle`, `createFlag`, `downloadContent`, `getImageExtensionFromURL`, `loadConfig`, `downloadItem`, `createEnqueue`, `moveFinished`. All paths are parameters; the server uses `./Download/...`, the CLI its cwd. yt-dlp is passed in (`ytDlp`), which is how tests fake it.

## Files (all under `Download/`)

| Path                 | Use                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tmp.json`           | The queue. Written atomically (temp file + rename); every write goes through one lock                                          |
| `history.json`       | One record per download id: the persistent state and dates ([History](#history-and-the-snapshot)). Same atomic write, own lock |
| `config.json`        | `userAgent` (and the CLI's `retryDelayMinutes`); created with defaults on the first run, read at every start                   |
| `cookies/<Site>.txt` | yt-dlp cookies for `meta:yt-cookie` items                                                                                      |
| `tmp/`               | In-flight and partial downloads, never cleared (yt-dlp resumes from them)                                                      |
| `done/<id>/`         | Staging per item: finished files plus sidecar until imported                                                                   |
| `error.log`          | Failures appended: `[title]: message` plus stack; read and cleared from the web ([Error log](#error-log))                      |

## Failure handling

- A failed item stays in `tmp.json`, its record is `failed` with `error`, and the message goes to `error.log`. Drop it with `downloads.remove` (the "Clear failed" button) instead of editing `tmp.json`.
- Files are never dropped: a failed import (duplicate id, invalid metadata, failed move, DB write error) leaves them in `Download/done/<id>/` (the sync rollback moves them back there). Files with an unsupported extension go to `UnSyncable/`, as in `Sync/`.
- The next run of a failed item with a staging folder skips the download and retries the import (fix the sidecar JSON by hand, or free the id, first). Delete the folder to force a new download.
- The sidecar title is made file-safe (`safeTitle`: `\ / : * ? " < > | %` become `_`) so it matches the file names; `prepareSync` renames to `<title>.<id>` from the JSON title and would fail on `/`. The queue entry keeps the original title.
- An id containing `/` or `\`, or equal to `.` / `..`, fails at once (it becomes a folder name).
- A download that exits 0 but leaves no files for the id fails ("produced no files") and leaves no sidecar.
- A missing `tmp.json` is an empty queue; invalid JSON makes `watch` / `start` throw (server error).

## Queue and `POST /downloads/set` during a run

- The body is `{ items, groups }` ([server API](./server-api.md)). `setDownloads` first registers the groups whose id is not in `DB/groups.json` (the Vault wins: existing ids and the incoming `cover` are ignored), then sets the queue. Each queue item keeps its `groups`; the staging sidecar carries them into `syncContent`, which creates any id still unknown.
- A run works on the queue it started with. Items posted later wait for the next `start`; nothing starts by itself.
- `set` while a run is active keeps every item of the run whose record is `queued`, `downloading` or `importing` exactly as it is (never dropped), and ignores a posted copy of the same id; the rest is replaced by what was posted. Idle: it just writes the posted list. Either way ids are de-duplicated (first wins) and the written list is returned. It also keeps the history in line: every posted item gets a record (`queuedAt` = now, status `queued`); re-posting an unfinished one keeps its record and `queuedAt` (only title, scraper, url and cover are refreshed); re-posting a completed one replaces that record with a new queued one; unfinished records of items that are no longer in the queue are deleted.
- Completed items are already gone from the queue; posting one again re-queues it. An item whose id is already in the library (and has no staged files) is never downloaded: the run drops it from the queue and marks it `completed`.
- A server restart loses nothing but the live progress: queue and history are files. Records left `downloading`/`importing` read as `queued` again; partial files in `tmp/` resume, staged items retry their import.

## Cancel and remove

- `downloads.cancel` (`cancelDownloads`): with `id`, stops that item if it is part of the run and its record is `queued` or `downloading`; without, every such item of the run. The record becomes `cancelled` (with `finishedAt`) at once, in the same history lock as the check, so an item that already moved on to `importing` is left alone, the item's `AbortController` fires (yt-dlp is killed through `ytDlp.exec(flags, undefined, signal)`, `fetch` aborts in `downloadContent`), items still waiting in the p-queue return as soon as their turn comes without starting, and the run ends normally (`running` goes false). A cancelled item stays in `tmp.json` (the next `start` runs it again, resuming from the partial files in `tmp/`) and is not written to `error.log`. Returns `{ cancelled: n }`; an unknown, finished or `importing` id cancels nothing (`importing` runs under `withSyncLock` and is atomic per item, so it always finishes).
- `downloads.remove` (`removeDownloads`, input `{ ids }`, ids validated like the staging folder name): runs under `withSyncLock`. Any id of the run whose record is `queued`/`downloading`/`importing` refuses the whole call with CONFLICT (cancel it first), so there is no partial removal. Then, per id: files in `Download/done/<id>/` (a failed import) move to `Sync/` so they can be fixed on the `/sync` page; a name already in `Sync/` is a CONFLICT and nothing moves; a failure while moving or writing the queue renames everything back. The item leaves `tmp.json`, the empty staging folder is removed, its history record is deleted (completed records are never deleted by `remove`; watchers are notified) and incomplete downloads of the id in `tmp/` (`<title>.<id>.<ext>.part`, `.part-FragN`, `.ytdl`, `.temp`; matched on the exact id so other items' files are safe) are deleted. Finished files in `tmp/` are never deleted. Returns `{ removed }`: the ids that were in the queue.
- Known limit: a `start` issued while a `remove` of the same item is in flight can still pick the item up (the window is a few ms); the web page disables nothing for this.

## Error log

- `Download/error.log` (`ERROR_LOG` in `services/downloads.ts`, also the CLI's `./error.log` when run from `Download/`) holds one `[title]: message` plus stack block per failed item. Cancels are not logged. Nothing trims it.
- `downloads.getErrorLog` (`readErrorLog`) returns `{ text, truncated }`: a missing file is `""`; a file over 1 MB (`ERROR_LOG_MAX`) returns only its last 1 MB, starting at a whole line, with `truncated: true`. `downloads.clearErrorLog` (`clearErrorLog`) deletes the file (a missing file is fine). Failed items stay in the queue; only their log entries go. Clearing is not locked against an append in the same instant.
- Other server errors (`errorLog()` in `lib/errorLog.ts`, route failures, sync) go to the console only and are not in this file or the web page.

## History and the snapshot

`Download/history.json` is `Record<id, DownloadRecord>`, one record per id, and is the source of truth. The server **keeps no copy in memory**: every use (snapshot, cancel, set, remove, clear) reads the file, and writes go through one lock as read-modify-write with a temp file + rename. Files are read with `readFile`, not `Bun.file().json()`, which can see a half-replaced file during the rename. Writes happen on status changes only, never on progress ticks.

Memory holds only the **live overlay** of the current run: `live` (percent, speed, eta of the items that are downloading/importing, dropped when each item finishes or is cancelled, cleared when the run ends) and `aborts` (one `AbortController` per unfinished item of the run, same lifetime). After a run both are empty (`liveStateSize()`, tested); the history is in the file.

```ts
interface DownloadRecord {
  id: string;
  title: string;
  scraper: string;
  url: string;
  cover?: string; // the remote cover URL of the queue item
  type?: CType; // the library type, set when completed
  status: TaskStatus; // queued | downloading | importing | completed | failed | cancelled
  percent: number; // 0-100 as of the last status change
  error?: string; // when failed
  // Unix timestamps in seconds, like the DB
  queuedAt: number; // entered the queue (POST /downloads/set); re-posting keeps it
  startedAt?: number; // the download (or the retried import) began
  finishedAt?: number; // completed, failed or cancelled
}

interface DownloadTask extends DownloadRecord {
  speed: string; // live: "1.2MiB/s", "Fetch" for direct downloads; "" otherwise
  eta: string; // live: "00:12"; "--:--" otherwise
  added?: number; // completed and still in the library: the DB's `added`
}

interface DownloadsSnapshot {
  running: boolean;
  tasks: DownloadTask[]; // the queue in order, then completed history, newest first
}
```

- Transitions: `set` creates the record (`queued`, `queuedAt`); `start` resets every item of the run to a fresh `queued` record (keeping `queuedAt`; a failed or cancelled one loses its error and dates); download begins: `downloading` + `startedAt` (an item that only retries a staged import gets `startedAt` at `importing`); import begins: `importing`; done: `completed` + `type` + `finishedAt`; failure: `failed` + `error` + `finishedAt`; cancel: `cancelled` + `finishedAt`. The percent in the record is the last live one at that moment.
- One record per id: a re-posted completed item gets a new queued record, so its earlier completed entry is gone from the history. The item itself is untouched in the library.
- `watch`/`getDownloadsSnapshot` build the list from `tmp.json` (read first), `history.json` and the overlay: queue items in queue order (each with its record, or a synthetic `queued` one dated by the file's mtime when a hand-edited queue has no record yet), then the `completed` records by `finishedAt` descending. A queue item whose record says `completed` is listed once, as completed. On completion the queue is written before the history, so a crash in between loses only the history entry of an item that is in the library. A record `downloading`/`importing` while no run owns the id (restart, crash) is reported as `queued` with percent 0 and no `startedAt`; the file is not rewritten until the item runs again. Unfinished records without a queue item are ignored (and pruned by `set`).
- For a completed item the web builds the library link/cover by looking the item up by `id` in `main.getAllContent` (`type` says the kind); `added` is absent when it was deleted from the library since.
- A history write failure is logged to the console and never fails a download. Invalid JSON in `history.json` makes the snapshot throw (like `tmp.json`).
- The history grows until it is cleared: `downloads.clearFinished` deletes `completed` records (all, or the given `ids`) and nothing else (never the library, media or the queue); failed, cancelled and queued records are not touched. "Clear failed" in the web is `downloads.remove` on failed and cancelled items: they leave the queue and their records are deleted (their history entry goes with them).

## oRPC procedures (`downloads`)

| Procedure       | Input                           | Output                                                                                            |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `start`         | none                            | `{ started: boolean }`: false when a run is already going or the queue is empty                   |
| `cancel`        | `{ id?: string }`               | `{ cancelled: number }`: see [Cancel and remove](#cancel-and-remove)                              |
| `remove`        | `{ ids: string[] }`             | `{ removed: string[] }`: drops items from the queue and their records, staged files go to `Sync/` |
| `clearFinished` | `{ ids?: string[] }` (optional) | `{ cleared: number }`: deletes completed history records only                                     |
| `getErrorLog`   | none                            | `{ text: string, truncated: boolean }`: the tail of `Download/error.log`                          |
| `clearErrorLog` | none                            | nothing: deletes `Download/error.log`                                                             |
| `watch`         | none                            | event stream (`text/event-stream` via oRPC event iterator) of `DownloadsSnapshot`                 |

There is no `getQueue`: the snapshot carries the queue.

- `watch` yields a full snapshot at once (even when idle), then a new full snapshot after changes (status changes, `set`, `remove`, `clearFinished`; there is no refetch to do). Status changes are sent immediately; progress ticks are coalesced to at most 4 per second. Snapshots may repeat the same state. It ends when the client aborts (the handler's `signal`). Each snapshot reads two small files.
- Streaming was checked end to end, also through the repo's Caddyfile (`encode zstd gzip` + `reverse_proxy`, client sending `Accept-Encoding: gzip, zstd`): `logger`, `trimTrailingSlash`, CORS and the `/rpc/*` handler do not buffer it, and oRPC sends a `: ` keep-alive comment every 5 s, under Bun's 10 s idle timeout. The web client needs oRPC's fetch link to consume the iterator; the `/downloads` page does ([web app](./web-app.md#state)). `DownloadsSnapshot` and `DownloadTask` are re-exported (types only) from `@tagapp/api`.

## CLI side effects to know

The CLI (`apps/cli`) and the server run the same queue file and `Download/tmp`. Nothing stops both at once; do not run them together on the same `Download/`.

## Tests

`packages/api/src/services/sync.test.ts` ("download:" tests) drives `startDownloads` with a fake yt-dlp: item lands in `media/` + DB + tag counts and leaves the queue, an id already in the library is dropped without downloading, staged files of a failed import are imported without downloading again, `setQueue` during a run. History tests (also in `sync.test.ts`): a run leaves completed records with dates in the file and `liveStateSize()` is 0 afterwards (and positive mid-run), re-posting keeps `queuedAt`, interrupted states read as `queued` in a fresh module instance, failed records go with `remove`, `clearFinished` drops completed ones only and leaves the DB and media alone. Cancel (a hung fake yt-dlp that closes with a null code on abort: the run ends, waiting items never start, nothing in `error.log`, items stay queued and run again) and remove (staged files to `Sync/`, active item refused, name clash is CONFLICT and moves nothing, partial downloads of the id deleted) are tested there too. `packages/utils/src/download/*.test.ts`: config, `fetch` retries and abort. The error log procedures (missing file, normal, over the cap, clear) have one test at the end of `sync.test.ts`. No network, no real yt-dlp.
