# Development

Scope: stack, repo map, commands, code conventions, imports, git workflow and files to ignore.

## Stack

Bun workspaces. Hono + oRPC (`/rpc`). Vite + React + wouter (hash router). LowDB (JSON files). Zod. Jotai + Constate + TanStack Query. Tailwind + shadcn/ui on Base UI (`base-nova`, preset `b2Pg`). Caddy (media + proxy). yt-dlp via `yt-dlp-wrap-plus`, Ink TUI and p-queue (CLI). Biome (lint and format). Server and CLI run on Bun only. The server downloads through the same `yt-dlp-wrap-plus` as the CLI ([server downloads](./server-downloads.md)).

## Repo map

| Path             | Package          | Role                                                                                                                                                                              |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`    | `tag-app-server` | Hono entry: [server API](./server-api.md)                                                                                                                                         |
| `apps/web`       | `tag-app-web`    | React SPA: [web app](./web-app.md)                                                                                                                                                |
| `apps/cli`       | `tag-app-cli`    | Download worker: [download CLI](./download-cli.md)                                                                                                                                |
| `apps/Caddyfile` | -                | Media and proxy: [deployment](./deployment.md)                                                                                                                                    |
| `packages/api`   | `@tagapp/api`    | oRPC `router`, `routers/*` (thin handlers), `services/*`, `db/*`, `lib/*`                                                                                                         |
| `packages/utils` | `@tagapp/utils`  | Shared Zod schemas, types, `CTypeDir`, `filterData`, helpers: [domain model](./domain-model.md); `@tagapp/utils/download`: download helpers for server and CLI (server-side only) |
| `Notes/`         | -                | `TagApp Server Reference.md`, human guide to the disk layout                                                                                                                      |

## Commands (root `package.json`)

| Command                                              | Does                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `bun install`                                        | Install workspaces                                                                                                       |
| `bun dev:server`                                     | `bun --watch src/index.ts` in `apps/server` (cwd is the runtime root)                                                    |
| `bun dev:web`                                        | Vite dev server; proxies `/rpc` and `/media` to a running server and Caddy: [web app](./web-app.md#setup)                |
| `bun type:check`                                     | `biome check`, then `tsc -b` in `apps/web` (which references and so also checks `packages/api` and `packages/utils`)     |
| `bun check` / `check:fix`                            | Biome lint and format check / apply                                                                                      |
| `bun lint` / `lint:fix`, `bun format` / `format:fix` | Biome lint or format alone                                                                                               |
| `bun test packages/api`                              | Sync and download-pipeline tests; Bun >= 1.4.2 ([sync pipeline](./sync-pipeline.md#tests))                               |
| `bun test packages/utils`, `bun test apps/cli`       | Download helper tests (config, fetch retries) / CLI args tests                                                           |
| `bun build:serverFull`                               | Full build into `apps/server/dist`: [deployment](./deployment.md)                                                        |
| `bun doctor:web`                                     | React Doctor scan of `apps/web` (score and findings); exits 1 when it finds an error-level issue: [below](#react-doctor) |
| `bun update:all`                                     | `bun -r update`                                                                                                          |

`apps/cli` has no dev script; build it and run from `dist/Download`. Single-part builds: `build:server`, `build:cli`, `build:web`, `build:caddy`.

## React Doctor

[React Doctor](https://github.com/millionco/react-doctor) is a dev dependency of `apps/web` (script `doctor`, root alias `doctor:web`). It is a static React linter configured in `apps/web/doctor.config.json` (skips `components/ui` and `dist`; ignores `js-set-map-lookups` as not worth the extra code; scoped overrides for verified false positives: `saveJsonFile.ts` revoke, the jotai derived-object atoms in `atom.ts` and `UpdateModal/atom.ts` (jotai only recomputes when a dependency changes), the `ContentCard.tsx` and `GroupCard.tsx` article click, whose checkbox and title link are the keyboard controls, and `query-mutation-missing-invalidation` in `Server.Context.ts`, which keeps the library in jotai atoms instead of the query cache). The script runs `react-doctor --yes` (non-interactive). Its telemetry and score upload are on by default and are not disabled in the script (opt out with `--no-telemetry`).

## Code conventions

- TypeScript, ESM, Zod at every boundary. Biome: 2-space indent, double quotes, recommended rules, organised imports; `noFloatingPromises` and `useExhaustiveDependencies` are warnings; `components/ui` is ignored.
- Web alias `@/` is `apps/web/src`. `@tagapp/api` exports `router` (type and value) and `settingsDB`; `@tagapp/utils` and `@tagapp/utils/types` are the shared entries.
- In `packages/api`, relative imports use a `.js` suffix in `index.ts`, `db/`, `services/`, `routers/main.ts` and `routers/fix.ts`; `routers/{audio,gallery,text,video}.ts` and `lib/generate*Data.ts` import without it. Both resolve under Bun; follow the file you are editing.
- Clients import server types only: `import type { router } from "@tagapp/api"`. Never import server runtime code into the web app.
- Server and CLI prefer Bun APIs; file-operation rules: [file operations](./file-operations.md).

## Git

- Solo project: commit directly on `main`, several small commits rather than one large one; no feature branches or PRs.
- Run `bun check:fix` and `bun type:check` before committing, plus `bun test packages/api` when touching `packages/api`.
- When behaviour changes, update the matching file in `docs/` in the same commit.

## Ignore these

- `apps/*/README.md`: untouched framework templates, not project docs.
- `tmp/`, `.devtool/`, `.vscode` are gitignored scratch folders.
