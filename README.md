# TagAppVault

Self-hosted, tag-based media library, the server-side port of TagApp 5.0. Content is downloaded into a queue, synced into a library on disk, then browsed, tagged and filtered in a web UI. Storage is the filesystem plus JSON files (LowDB); there is no SQL database.

Status: personal project for trusted-LAN use. There is no authentication and CORS is `*`.

**Stack:** Bun workspaces, Hono + oRPC (`/rpc`), Vite + React + wouter (hash router), LowDB, Zod, Jotai + Constate + TanStack Query, Tailwind + shadcn/ui on Base UI, Caddy, yt-dlp + Ink (CLI), Biome.

## Quick start

```bash
bun install
bun dev:server       # server on :5001; runtime files land in apps/server
bun dev:web          # Vite; mock pages at http://localhost:5173/#/mock
bun check            # lint + format
bun build:serverFull # full build into apps/server/dist (server, web UI, CLI, Caddyfile)
```

All commands, conventions and the production layout: [docs/development.md](docs/development.md), [docs/deployment.md](docs/deployment.md).

## Architecture

| Path             | Role                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `apps/server`    | Hono entry: mounts oRPC at `/rpc`, `POST /downloads/set`, serves the built web UI           |
| `apps/web`       | React SPA to browse and edit the library; also hosts dev-only mock pages                    |
| `apps/cli`       | Download worker: reads the queue, runs yt-dlp or a direct fetch, drops results into `Sync/` |
| `apps/Caddyfile` | `:5000`: serves `/media/*` from disk, proxies the rest to the server on `:5001`             |
| `packages/api`   | oRPC routers, sync/delete/update services, LowDB stores (`@tagapp/api`)                     |
| `packages/utils` | Shared Zod schemas and types, filtering, helpers (`@tagapp/utils`)                          |
| `Notes/`         | Human guide to the folder layout                                                            |

```
browser --> Caddy :5000 --/media/*--> media/ (files on disk)
               |
               +--everything else--> server :5001 (apps/server + packages/api)
                                       /rpc, /downloads/set, built web UI --> DB/*.json

POST /downloads/set --> Download/tmp.json --> apps/cli --> Sync/ --(sync)--> media/ + DB/
```

## Contributing

- Setup: `bun install`, then run the dev command for the part you touch. Solo project: commit directly on `main`, in small commits with conventional-style messages (`feat(web): ...`, `fix(api): ...`, `chore: ...`).
- Before committing run `bun check:fix` and `bun type:check`, plus `bun test packages/api` if you touched `packages/api`.
- If you change behaviour, update the matching file in `docs/` in the same commit; a new topic gets a new doc.

More: [AGENTS.md](AGENTS.md) (index for coding agents) and [docs/](docs/).
