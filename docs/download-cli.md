# Download CLI

Scope: `apps/cli` (`tag-app-cli`), the Ink TUI worker that turns the download queue into files in `Sync/`. What happens after: [sync pipeline](./sync-pipeline.md). Entry: `src/index.tsx`; helpers in `src/lib/`.

## Run

- Build: `bun build:cli` writes `apps/server/dist/Download/index.js`. Run from `dist/Download` with `bun index.js`: all its paths are cwd-relative ([deployment](./deployment.md)).
- Paths (`lib/constants.ts`): queue `tmp.json`, scratch `./tmp`, output `../Sync`, log `./error.log`, cookies `./cookies/<Site>.txt` (so `Download/cookies/` next to the server's `Download/tmp.json`), config `config.json`.
- The queue is read at the start of each run (`readFileSync`, no guard): a missing or invalid `tmp.json` crashes the CLI. The server writes it via `POST /downloads/set`: [server API](./server-api.md).
- The process exits once every task is completed or failed (and no retry is pending).
- `./tmp` is never cleared. Leftovers (partial downloads) stay so the next run can resume them.

## Flags (`lib/args.ts`)

- `-h`, `--help`: print usage (flags and the files above) and exit 0.
- `-r`, `--retry [N]`: after a full run, re-read `tmp.json`; if items remain, wait `retryDelayMinutes`, print `Retrying in X min (attempt a/N)...` and run the remaining queue again (fresh queues, fresh Ink render). No `N`: retry until the queue is empty. `N` must be a positive integer: at most `N` retries.
- Unknown flags or a bad `N`: error plus usage, exit 1.

## Config (`config.json`, `lib/config.ts`)

Lives in the cwd next to `tmp.json`. Created with defaults on start if missing; read on every start.

| Key                 | Default           | Use                                                                              |
| ------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `userAgent`         | current Chrome UA | `fetch` downloads, and yt-dlp `--user-agent` unless the item's own flags set one |
| `retryDelayMinutes` | `5`               | wait between `--retry` runs                                                      |

A missing (or wrongly typed) key falls back to its default; missing keys are written back, other values are left as the user set them. Invalid JSON: error and exit 1, the file is not touched.

## Concurrency

- One download at a time per `scraper`, three overall (`p-queue`: a queue per scraper feeding a global queue).

## Download types

| `item.download?.type`   | Behaviour                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `direct`                | Fetches `item.cover` and `item.contentUrl` with `fetch` (`userAgent` from config, streamed to disk). Both are required |
| anything else or absent | Runs yt-dlp (`yt-dlp-wrap-plus`) with flags from `createFlag`                                                          |

yt-dlp flags (`lib/createFlags.ts`): the item URL, `-o ./tmp/<base>.%(ext)s`, `--embed-thumbnail -R 3 --continue --no-overwrites`, then `download.flags.value` split on whitespace (quoted values stay whole; `--no-part` and `--no-continue` are dropped so resuming keeps working), `--user-agent <config userAgent>` unless the item flags set one, then the meta tags below.

- `meta:yt-cookie`: needs a `Site:<name>` tag and `./cookies/<name>.txt`, else the task fails; adds `--cookies`.
- `meta:different-cover`: downloads `item.cover` itself (needs `cover`); otherwise `--write-thumbnail` with the thumbnail output `cover.<base>.%(ext)s`.
- Tag semantics: [domain model](./domain-model.md#meta-tags).
- Resuming: yt-dlp keeps `.part` files and `--continue` picks them up on the next run; `--no-overwrites` skips files that already finished. `direct` downloads (and the `meta:different-cover` cover) write to `<file>.part` and rename on success; an existing finished file is skipped (no HTTP range resume, so a partial `.part` is refetched in full).
- Fetch retries (`lib/downloadContent.ts`): network errors, `429` and `5xx` are retried up to 3 attempts in total, waiting 2s then 4s; other `4xx` fail at once. Longer outages are left to `--retry`.
- Cover extension for direct downloads comes from the URL's `ext` query parameter, else the path extension; no extension throws (`getImageExtensionFromURL`).

## File naming and completion

- `fileBase(title, id)` = `<title>.<id>` with `\ / : * ? " < > | %` and control characters replaced by `_`, trimmed.
- On success every file in `./tmp` containing `.<id>.` (except `*.part`, `*.part-FragN`, `*.ytdl`, `*.temp` leftovers, which stay in `./tmp`) moves to `../Sync` (so one id cannot match a longer id), `<title>.<id>.json` is written there with the whole queue item, and the item is removed from `tmp.json`.
- On failure the task is marked failed and the message plus stack are appended to `error.log`; the item stays in the queue.
