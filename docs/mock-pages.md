# Mock pages (dev only)

Scope: `apps/web/src/mock/`, which renders the real web app on a fake server with invented data, so UI changes can be checked without a server, Caddy or runtime directory. No real data can be touched.

## Open

- `bun dev:web`, then `http://localhost:5173/#/mock` (index) or `#/mock/<slug>?s=<scenario>&x=<0|1>`.
- Slugs (`pages.ts`, `MOCK_PAGES`): `library`, `tags`, `generate`, `reference`, `not-found`, `image`, `video`, `gallery`, `text`, `audio`. Each opens the real route in an in-memory router (`MockApp.tsx` mounts the real `AppLayout`).
- Scenarios: `normal`, `stress` (long titles, 60+ character unbroken ids, 46 tags on one item, zero-tag items, many cover shapes, 150-file gallery, 40 tracks, 24 chapters), `empty`, `noresults`, `loading`, `error`. Each page lists the ones that apply (`scenarios`).
- On item pages `noresults` means the item does not exist. On gallery, text and audio pages `loading` and `error` hit only the file-list procedures (`affects`), so the page frame still renders.
- `x=0` switches the extension off. With it on, `MockApp` posts `TAG_APP_INJECT_TAGS` like the extension and shows whether the app replied `TAG_APP_TAGS_RECEIVED`; with it off the app is read-only ([web app](./web-app.md#extension-handshake-and-read-only-mode)).
- Changing scenario or the switch reloads the tab on purpose (`hashchange` in `index.tsx`): filters and tags live in module-level atoms and the fake server keeps data in memory.

## Dev-only wiring

- `App.tsx`: `const Mock = import.meta.env.DEV ? lazy(() => import("./mock")) : null`, so `vite build` contains none of it. Check: `grep -rlE "Homemade pasta|gen_vidPasta01" apps/server/dist/WebUI` finds nothing after `bun --cwd apps/web build`.
- `lib/orpc.ts` looks `fetch` up per request, which is what lets the mock swap it.
- `index.tsx` also injects a CSP meta (`img-src 'self' data: blob:`) and wraps pages in an error boundary.

## Layout

- `data.ts`: invented data and scenario builders (`buildDb`, `countTags`, `SAMPLE_ID`).
- `stubs.ts`: the fake server. `handlers` has one entry per oRPC procedure keyed `<router>/<procedure>`; a patched `fetch` answers `/rpc/...` and `/media/Texts/...` chapter text; `/media/...` image URLs become generated gradient data URIs; video, audio, source and track `src` are not requested.
- `pages.ts` page list, `MockApp.tsx`, `MockShell.tsx` (scenario bar), `useScenario.ts` (`?s=` and `?x=` in the hash), `index.tsx` (index page).

## Adding a page or procedure

- Page: add an entry to `MOCK_PAGES` (slug, route to open, scenarios, optional `affects`, `search`). Keep data neutral and invented.
- Procedure: when a new oRPC procedure is used by the UI, add its handler to `handlers` in `stubs.ts` ([server API](./server-api.md#add-an-endpoint)). Mutations change only the fake server's memory.

## Not covered

- Real video and audio playback (players are empty, cover capture from a video frame cannot run), file uploads (`setCoverGivenFile` takes a `File`), the sync pipeline, the CLI, Caddy and anything on disk.
- The cards' "open in a new tab" links go to the real hash routes, which are not mocked.
