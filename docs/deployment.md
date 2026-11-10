# Deployment

Scope: build outputs, how the pieces run together, and the Caddy media server. Code: root `package.json` scripts, `apps/Caddyfile`.

## Build

`bun build:serverFull` removes `apps/server/dist`, then builds into it:

| Step                                                   | Output in `apps/server/dist`                            |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `build:server` (`bun build src/index.ts --target bun`) | `index.js`                                              |
| `build:cli`                                            | `Download/index.js` ([download CLI](./download-cli.md)) |
| `build:web` (`vite build --emptyOutDir`)               | `WebUI/`                                                |
| `build:caddy`                                          | `Caddyfile` (copy of `apps/Caddyfile`)                  |

Other commands: [development](./development.md).

## Running

- Server paths are cwd-relative, and the CLI's `tmp.json` and `../Sync` only line up with the server's `Download/tmp.json` and `Sync/` when the server's cwd is `dist`. So run the built server and Caddy from `dist`, where `index.js` and `WebUI/` already are. The server creates the data dirs at start ([disk layout](./disk-layout.md)).
- The server downloads by itself ([server downloads](./server-downloads.md)). To use the CLI instead (headless), run it from `dist/Download` (`bun index.js`): its `tmp.json` and `../Sync` resolve to the server's `Download/tmp.json` and `Sync/`.
- Server port and UI prefix come only from `settings.json` ([server API](./server-api.md)). Run the server on `:5001` behind Caddy on `:5000`; the Caddyfile hardcodes both.
- In development the server runs in `apps/server` and Vite serves the web app: [development](./development.md).

## Caddy (`apps/Caddyfile`)

Site `:5000`, `root * .`, gzip/zstd, `Access-Control-Allow-Origin *` for GET/OPTIONS.

| Path                                                 | Behaviour                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/media/Images/.covers/*`, `/media/Videos/.covers/*` | `Cache-Control: no-store`; `try_files` tries `.avif .jpg .jpeg .png .webp` appended to the path, then the path itself |
| `/media/Images/*`                                    | same `try_files`, no cache header                                                                                     |
| `/media/Videos/*`                                    | `try_files` the path, then `.mp4`, `.webm`, `.mkv` appended                                                           |
| other `/media/*`                                     | plain `file_server`                                                                                                   |
| everything else                                      | `reverse_proxy localhost:5001`                                                                                        |

- The fallbacks let URLs omit the extension: the image and video pages request `/media/<Dir>/<encoded title.id>` and `/media/<Dir>/.covers/cover.<encoded title.id>` with no extension.
- Gallery, audio and txt folders are served by the plain rule, which is why their cover dirs are not under `.covers`: [disk layout](./disk-layout.md).
