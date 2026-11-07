# UI components

Scope: the component layers in `apps/web/src/components`, the Base UI differences from Radix, the `PopoverContent` additions and the shadcn CLI setup.

## Layers

| Path                                | Rule                                                                                                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ui/`       | Stock shadcn, generated. Never edit; Biome ignores it (`!**/components/ui` in `biome.json`)                                                                                                                                                                    |
| `apps/web/src/components/craft/ui/` | Customised primitives. Only `popover.tsx` today; change primitives here                                                                                                                                                                                        |
| `apps/web/src/components/craft/`    | App-level pieces: `MultiSelect`, `EmptyState` (`EmptyState`, `LoadingState`, `ErrorState`), `confirm-dialog` (`confirm`, `ConfirmProvider`), `ModalShell`, `FloatingToolbar`, `TitleHeader`, `Spinner`, `UpdateModal/`, `BulkUpdateModal`, `library/`, `tags/` |
| `apps/web/src/components/`          | Top-level: `NavBar`, `NavBarLinks`, `theme-provider`, `mode-toggle`, `LazyVideo`                                                                                                                                                                               |

- `ConfirmProvider` is mounted once in `App.tsx`; call `confirm(...)` or `confirm.destructive|warning|info|success(...)` from anywhere, it resolves to a boolean.

## Base UI, not Radix

- Triggers take `render={<Button />}`, not `asChild` (e.g. `DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}` in `NavBarLinks.tsx`).
- State attributes are `data-open` / `data-closed` (the popover classes use `data-open:animate-in`), not `data-[state=open]`.

## PopoverContent `anchor` / `container`

- Source: `components/craft/ui/popover.tsx`. It re-exports the stock `ui/popover` and replaces `PopoverContent`, because the stock one cannot forward props to the Positioner and Portal.
- `anchor`: element the popup positions against. `container`: portal target, default `document.body`; pass a node inside a modal.
- `MultiSelect` passes `anchor` and `container={wrapper}` so the dropdown stays inside the modal that holds it instead of fighting its focus handling.

## shadcn CLI

- Config: `apps/web/components.json` (style `base-nova`, css `src/index.css`, icons `lucide`, base colour `neutral`).
- Preset `b2Pg` is applied via the CLI; the preset id is not recorded in `components.json`.
- After re-running `shadcn apply`, delete the `--radius` the CLI leaves in `.dark` and any `body { font-family }` it keeps. `:root` in `src/index.css` defines `--radius: 0`.
