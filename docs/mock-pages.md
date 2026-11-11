# Mock pages (dev only)

Scope: `apps/web/src/mock/`, which renders the real web app on a fake server with invented data, so UI changes can be checked without a server, Caddy or runtime directory. No real data can be touched.

## Open

- `bun dev:web`, then `http://localhost:5173/#/mock` (index) or `#/mock/<slug>?s=<scenario>&x=<0|1>`.
- Slugs (`pages.ts`, `MOCK_PAGES`): `library`, `groups`, `group`, `group-empty`, `sync`, `downloads`, `tags`, `generate`, `reference`, `settings`, `not-found`, `image`, `video`, `gallery`, `text`, `audio`. Each opens the real route in an in-memory router (`MockApp.tsx` mounts the real `AppLayout`).
- Scenarios: `normal`, `stress` (long titles, 60+ character unbroken ids, 46 tags on one item, zero-tag items, many cover shapes, 150-file gallery, 40 tracks, 24 chapters), `empty`, `noresults`, `loading`, `error`. Each page lists the ones that apply (`scenarios`).
- Groups: the library mock has 3 groups (`stress` adds a long-titled one with 12 children and many tags): "Travel and outdoors" (one child has `view:in-library`, so it also shows as an item), "Kitchen and garden" (own cover; shares `gen_galMarket01` with the first) and an empty group (no library card). `gen_imgNoTags01` carries a group id without a record and stays visible. With "extension connected" the cards offer Disband and items "Add to group…"; Settings has the group sort and cover pick. `GROUP_ID` in `data.ts` names the groups the pages open.
- Group pages: `#/mock/groups` (`/group`: all three groups incl. the empty one, search, Fix Data, edit, merge, disband, delete; deleting "Travel and outdoors" or "Kitchen and garden" shows the shared-items dialog because they share `gen_galMarket01`), `#/mock/group` (`/group/grp_mockTravel1`, `stress`: the long-id group; `empty`: group not found because there are no groups; `noresults`: search finds nothing) and `#/mock/group-empty` (the group without items). Edit, Fix Data, disband, delete, merge, Remove from group and item deletes need "extension connected" and change only the fake server's memory ([groups](./groups.md)).
- `gallery/bulkUpdateContentTags` is stubbed, so Select files → Edit tags works on `#/mock/gallery`.
- On item pages `noresults` means the item does not exist. On gallery, text and audio pages `loading` and `error` hit only the file-list procedures (`affects`), so the page frame still renders.
- `x=0` switches the extension off. With it on, `MockApp` posts `TAG_APP_INJECT_TAGS` like the extension and shows whether the app replied `TAG_APP_TAGS_RECEIVED`; with it off the app is read-only ([web app](./web-app.md#extension-handshake-and-read-only-mode)).
- Changing scenario or the switch reloads the tab on purpose (`hashchange` in `index.tsx`): filters and tags live in module-level atoms and the fake server keeps data in memory.

## Dev-only wiring

- `App.tsx`: `const Mock = import.meta.env.DEV ? lazy(() => import("./mock")) : null`, so `vite build` contains none of it. Check: `grep -rlE "Homemade pasta|gen_vidPasta01" apps/server/dist/WebUI` finds nothing after `bun --cwd apps/web build`.
- `lib/orpc.ts` looks `fetch` up per request, which is what lets the mock swap it.
- `index.tsx` also injects a CSP meta (`img-src 'self' data: blob:`) and wraps pages in an error boundary.

## Layout

- `data.ts`: invented data and scenario builders (`buildDb` including `groups`, `countTags` counting items and groups, `SAMPLE_ID`).
- `stubs.ts`: the fake server. `handlers` has one entry per oRPC procedure keyed `<router>/<procedure>`; a patched `fetch` answers `/rpc/...` and `/media/Texts/...` chapter text; `/media/...` image URLs become generated gradient data URIs; video, audio, source and track `src` are not requested.
- `pages.ts` page list, `MockApp.tsx`, `MockShell.tsx` (scenario bar), `useScenario.ts` (`?s=` and `?x=` in the hash), `index.tsx` (index page).

## Adding a page or procedure

- Page: add an entry to `MOCK_PAGES` (slug, route to open, scenarios, optional `affects`, `search`). Keep data neutral and invented.
- `groups/*` handlers run the pure group operations of `@tagapp/utils` (`createGroup`, `addGroupItems`, `deleteGroup`, …) on the fake db's `contents` and `groups`, so the mock follows the real rules; op errors become BAD_REQUEST and tag counts are recomputed.
- Procedure: when a new oRPC procedure is used by the UI, add its handler to `handlers` in `stubs.ts` ([server API](./server-api.md#add-an-endpoint)). Mutations change only the fake server's memory. The `sync` page uses `state.pending` (`buildSync` in `data.ts`): edit and remove change it, `main/sync` moves it into the library. The `downloads` page uses `dl` in `stubs.ts` (`buildDownloads`: the whole snapshot list; `normal` starts with 3 completed items with dates (the first library items, so their local covers and links resolve through `main/getAllContent`), one frozen downloading item (so `running` is true until it is cancelled), one failed, one cancelled and 2 queued; `stress` has more, with long titles and a long error. Mock `cover`s are `/media/Downloads/.covers/...` URLs, which become gradients; one in five has none and one in five points at `example.invalid`, which the mock CSP blocks, so the placeholder shows; `empty` has none): `downloads/start` replays one fake run over every unfinished item (they download, import and become completed history; `stress` fails the last one), `downloads/clearFinished` drops completed entries only `downloads/getErrorLog` / `clearErrorLog` serve and empty `state.errorLog` (`buildErrorLog`: 3 entries, 400 in `stress` with `truncated: true`, empty in `empty`; a `stress` failure appends one), and `downloads/cancel` and `downloads/remove` mimic the server (queued/downloading tasks become `cancelled` and stay queued; remove refuses active tasks with CONFLICT and drops the rest from the queue and the snapshot); `downloads/watch` is answered in `answer()` with a real `text/event-stream` body (`event: message` + `data: {"json":…}`), pushed to every open stream on each tick. Scenarios: normal, stress, empty, loading, error.

## Not covered

- Real video and audio playback (players are empty, cover capture from a video frame cannot run), file uploads (`setCoverGivenFile` takes a `File`), the sync pipeline, the CLI, Caddy and anything on disk.
- The cards' "open in a new tab" links go to the real hash routes, which are not mocked.
