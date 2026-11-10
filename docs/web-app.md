# Web app

Scope: `apps/web` (`tag-app-web`), the React SPA that browses and edits the library: routes, state, the oRPC client and the extension handshake. Components and shadcn rules: [ui components](./ui-components.md). Dev-only fake-server pages: [mock pages](./mock-pages.md).

## Setup

- Vite + React, wouter with the hash router (`useHashLocation`), TanStack Query via `@orpc/tanstack-query`, Jotai, Constate. Alias `@/` is `apps/web/src`.
- Builds into `apps/server/dist/WebUI` ([deployment](./deployment.md)). The oRPC client posts to `${location.origin}/rpc` (`src/lib/orpc.ts`) and media URLs are same-origin `/media/...`, so `vite.config.ts` proxies `/rpc` to the server (`localhost:5001`, the default in `db/settings.ts`) and `/media` to Caddy (`localhost:5000`). `bun dev:web` therefore needs `bun dev:server` and Caddy running for real data (change the constants if `settings.json` uses another port); the [mock pages](./mock-pages.md) need neither.
- `src/App.tsx`: router, theme, toaster, confirm dialog, the extension message listener, and the dev-only `#/mock` route. `src/AppLayout.tsx`: nav bar and route table, shared with the mock pages. Query client defaults: no refetch on focus or mount, `retry: 1`.

## Routes (`src/routes`, lazy loaded in `AppLayout.tsx`)

| Hash route                                                     | Page                      | Notes                                                                                                          |
| -------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/`                                                            | `routes/index.tsx`        | Library: filters, results, selection, edit, bulk edit, "Sync library". Wrapped by `contexts/Server.Context.ts` |
| `/sync`                                                        | `routes/sync.tsx`         | Sync preview (`main.getSyncData`): own filters, edit / remove pending items, Refresh (rescan only) and Sync    |
| `/downloads`                                                   | `routes/downloads.tsx`    | Server download queue (`downloads.getQueue`) with live progress (`downloads.watch`); "Start downloads"         |
| `/tags`                                                        | `routes/tags.tsx`         | Tag counts, `hardResetTagCount`, `softResetTagCount`                                                           |
| `/generateContentJson`                                         | `routes/generateJSON.tsx` | Builds a metadata JSON file to put in `Sync/` by hand; needs tags from the extension                           |
| `/reference`                                                   | `routes/reference.tsx`    | Renders `Notes/TagApp Server Reference.md` (`?raw` import)                                                     |
| `/img/:id` `/video/:id` `/gallery/:id` `/txt/:id` `/audio/:id` | `routes/<type>/[id].tsx`  | Item pages inside `DocProvider` (`contexts/Doc.Context.tsx`); anything else gets `404.tsx`                     |

- Page code lives in `routes/<type>/`, shared pieces in `routes/components/`, generic pieces in `components/`.
- `DocProvider` sits inside a route matching `DOC_ROUTE`; without that wrapper `Switch` would match it for every URL and the 404 would never render.
- Media URLs are built from `encodeURIComponent("<title>.<id>")` against `/media/...` ([deployment](./deployment.md)).
- Item notes (`DocInfoSection`) and text chapters (`routes/txt/[id].tsx`) render markdown with `rehype-raw` then `rehype-sanitize` (default schema), so embedded HTML is allowed but scripts, event handlers and `<iframe>`/`<video>` are stripped. `/reference` renders a bundled file without sanitizing.

## State

- `src/atom.ts`: theme (`localStorage` key `vite-ui-theme`), filter atoms, `FilterQueryAtom`, `filterActiveAtom` (separates "empty library" from "no results") and `tagsAtom`. `realtimeFilterAtom` (`localStorage` key `realtime-filter`) is the "Realtime" switch in the filters panel. Filters are mirrored into the URL query (`any`, `all`, `none`, `types`, `search`, `orderByLatest`) by `injectFilterDataIntoURLAtom` and read back on load.
- Filtering is client-side: the library page loads everything once via `main.getAllContent` into `allContentAtom` and runs the shared `filterData` into `filteredAtom` (`Server.Context.ts`). The Filter button applies the filters; with Realtime on, a debounced effect (200 ms) re-filters whenever `FilterQueryAtom` changes and updates the URL with `replaceState`. Sync refetches everything; edit, bulk update and delete patch both lists in place.
- `/sync` keeps its own filter state in component state (`useState`, not the library's atoms or URL query) and filters `getSyncData().contents` with the same `filterData`; it shares only `realtimeFilterAtom`. The scan is a `useQuery` refetched on open and after edit, remove and sync. It reuses `FilterPanel`, `ContentCard` (no `url`, no cover: files in `Sync/` aren't served) and `UpdateModal` (edit stays in the global update atoms, so only one page uses it at a time). Controls need `tagsAtom` like the library.
- `/downloads` merges the queue with the live task state (`mergeRows` in `routes/downloads.merge.ts`, tested with `bun test apps/web/src/routes`; test files are excluded from the web `tsc` build): queue items no run has touched show as "Queued, not started", completed tasks (already out of the queue) follow. The stream is `orpc.downloads.watch.experimental_liveOptions` (keeps only the latest snapshot); `gcTime: 0` + `refetchOnMount: "always"` mean leaving the page aborts the request and coming back reconnects, and a stream error is retried 4 times with React Query's backoff before a "Reconnect" line shows. The queue is refetched whenever `running` or the finished-task count changes. The library needs no invalidation: it reloads `main.getAllContent` (a mutation) every time it mounts. Start is hidden without `tagsAtom`, like the other changing controls; viewing progress is always allowed.
- `routes/atom.ts` (all items, result list, server tags), `routes/atom.selection.ts` (selection mode), per-type `atom.ts` files, `components/craft/UpdateModal/atom.ts`.
- Mutations replace objects instead of editing in place: memoised cards skip re-render on an identical reference.

## Extension handshake and read-only mode

- The TagApp browser extension (a separate project) posts `TAG_APP_INJECT_TAGS` with a string array via `window.postMessage`. `App.tsx` accepts it only when `event.source === window`, stores it in `tagsAtom` and replies `TAG_APP_TAGS_RECEIVED`.
- `tagsAtom` is `null` until then. While it is `null` the app is read-only: the library hides edit, remove and sync controls, item pages hide edit, remove and cover controls, and Generate JSON shows a waiting state.

## Rules

- Titles are sanitized with `sanitizeStringForFileName` before `setContent`: [domain model](./domain-model.md#identity).
- The web app imports server types only (`import type { router } from "@tagapp/api"`); never server runtime code ([development](./development.md)).
- `src/lib/TIMEOUTS.ts` is a small timeout registry used by the library page.
