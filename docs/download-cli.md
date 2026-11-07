# Download CLI

Scope: `apps/cli` (`tag-app-cli`), the Ink TUI worker that turns the download queue into files in `Sync/`. What happens after: [sync pipeline](./sync-pipeline.md). Entry: `src/index.tsx`; helpers in `src/lib/`.

## Run

- Build: `bun build:cli` writes `apps/server/dist/Download/index.js`. Run from `dist/Download` with `bun index.js`: all its paths are cwd-relative ([deployment](./deployment.md)).
- Paths (`lib/constants.ts`): queue `tmp.json`, scratch `./tmp`, output `../Sync`, log `./error.log`, cookies `./cookies/<Site>.txt` (so `Download/cookies/` next to the server's `Download/tmp.json`).
- The queue is read once at start (`readFileSync`, no guard): a missing or invalid `tmp.json` crashes the CLI. The server writes it via `POST /downloads/set`: [server API](./server-api.md).
- The process exits once every task is completed or failed.

## Concurrency

- One download at a time per `scraper`, three overall (`p-queue`: a queue per scraper feeding a global queue).

## Download types

| `item.download?.type`   | Behaviour                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `curl`                  | Fetches `item.cover` and `item.contentUrl` with `fetch` (Chrome user agent, streamed to disk). Both are required |
| anything else or absent | Runs yt-dlp (`yt-dlp-wrap-plus`) with flags from `createFlag`                                                    |

yt-dlp flags (`lib/createFlags.ts`): the item URL, `-o ./tmp/<base>.%(ext)s`, `--embed-thumbnail -R 3`, then `download.flags.value` split on whitespace (quoted values stay whole), then the meta tags below.

- `meta:yt-cookie`: needs a `Site:<name>` tag and `./cookies/<name>.txt`, else the task fails; adds `--cookies`.
- `meta:different-cover`: downloads `item.cover` itself (needs `cover`); otherwise `--write-thumbnail` with the thumbnail output `cover.<base>.%(ext)s`.
- Tag semantics: [domain model](./domain-model.md#meta-tags).
- Cover extension for direct downloads comes from the URL's `ext` query parameter, else the path extension; no extension throws (`getImageExtensionFromURL`).

## File naming and completion

- `fileBase(title, id)` = `<title>.<id>` with `\ / : * ? " < > | %` and control characters replaced by `_`, trimmed.
- On success every file in `./tmp` containing `.<id>.` moves to `../Sync` (so one id cannot match a longer id), `<title>.<id>.json` is written there with the whole queue item, and the item is removed from `tmp.json`.
- On failure the task is marked failed and the message plus stack are appended to `error.log`; the item stays in the queue.
