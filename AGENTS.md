# AGENTS.md

Index for coding agents. Read the doc that owns your task before editing; docs link to code, code is the source of truth.

TagAppVault is a self-hosted tag-based media library: a queue of downloads (CLI) is synced into a library on disk, and a React web UI browses and tags it through a Hono + oRPC server. Storage is the filesystem plus LowDB JSON files. Human overview: [README.md](README.md).

Layout: `apps/server`, `apps/web`, `apps/cli`, `apps/Caddyfile`, `packages/api` (routers, services, DB), `packages/utils` (shared schemas, filtering), `Notes/` (human guide to the disk layout), `docs/`.

## Invariants

- Every item on disk is named `<title>.<id>`; the id never changes: [domain model](docs/domain-model.md).
- Tag counts in `DB/tags.json` must stay in sync with items: [domain model](docs/domain-model.md).
- File operations roll back on failure; deletes are two-phase and the DB is written only after fs success: [file operations](docs/file-operations.md).
- Scans and syncs are serialized by `withSyncLock`: [sync pipeline](docs/sync-pipeline.md).
- Router files export procedures only (every export becomes one): [server API](docs/server-api.md).
- `components/ui` is stock shadcn and immutable; customise in `components/craft/ui`: [ui components](docs/ui-components.md).
- Clients import server types only, never server code: [development](docs/development.md).

## Docs

| Doc                                                                      | Read it when you are...                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [docs/domain-model.md](docs/domain-model.md)                             | changing content types, schemas, tags, meta tags, filtering    |
| [docs/disk-layout.md](docs/disk-layout.md)                               | touching the runtime tree, extensions, covers, generated files |
| [docs/sync-pipeline.md](docs/sync-pipeline.md)                           | working on the queue-to-library flow or sync tests             |
| [docs/file-operations.md](docs/file-operations.md)                       | changing rename, delete or per-type edit routers               |
| [docs/download-cli.md](docs/download-cli.md)                             | working on `apps/cli`, yt-dlp flags, cookies                   |
| [docs/server-api.md](docs/server-api.md)                                 | adding endpoints, changing settings, port, prefix, startup     |
| [docs/deployment.md](docs/deployment.md)                                 | building, running, or changing the Caddyfile                   |
| [docs/web-app.md](docs/web-app.md)                                       | working on `apps/web` routes, state, extension handshake       |
| [docs/ui-components.md](docs/ui-components.md)                           | working with shadcn/Base UI components                         |
| [docs/mock-pages.md](docs/mock-pages.md)                                 | checking web UI without a server                               |
| [docs/development.md](docs/development.md)                               | running commands, linting, committing                          |
| [Notes/TagApp Server Reference.md](Notes/TagApp%20Server%20Reference.md) | needing the long human guide to the folder layout              |

## Where to change X

| Task                       | Read                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New content type           | [domain model](docs/domain-model.md), [disk layout](docs/disk-layout.md), [sync pipeline](docs/sync-pipeline.md), [file operations](docs/file-operations.md) |
| New meta tag               | [domain model](docs/domain-model.md), [download CLI](docs/download-cli.md)                                                                                   |
| Sync behaviour             | [sync pipeline](docs/sync-pipeline.md)                                                                                                                       |
| Delete or rename behaviour | [file operations](docs/file-operations.md)                                                                                                                   |
| Filtering or search        | [domain model](docs/domain-model.md)                                                                                                                         |
| Download flags or yt-dlp   | [download CLI](docs/download-cli.md)                                                                                                                         |
| Server prefix or port      | [server API](docs/server-api.md)                                                                                                                             |
| New endpoint               | [server API](docs/server-api.md), [mock pages](docs/mock-pages.md)                                                                                           |
| Media serving rules        | [deployment](docs/deployment.md)                                                                                                                             |
| Web page or state          | [web app](docs/web-app.md), [ui components](docs/ui-components.md)                                                                                           |

## Rules

- When behaviour changes, update the matching doc in the same change.
- For a new topic, add a new doc under `docs/` and list it above instead of growing an existing one.
