# TagApp5.0

Latest iteration of TagApp.

## Current Stack

| Category              | Technology                             |
| --------------------- | -------------------------------------- |
| **Server**            | Hono                                   |
| **Web**               | Vite React (wouter with useHashRouter) |
| **Database**          | JSON with LowDB                        |
| **Browser Extension** | WXT JS                                 |
| **State Management**  | Jotai + Constate                       |
| **Styling**           | Tailwind CSS                           |
| **UI Components**     | Shadcn UI                              |
| **Media Server**      | Caddy                                  |

## Major Architectural Revisions from TagAppExt 4.0

| Feature               | TagAppExt 4.0 (Old)      | TagApp 5.0 (New)                   |
| --------------------- | ------------------------ | ---------------------------------- |
| **Project Structure** | Monolithic (Hardcoded)   | Monorepo (`apps/` & `packages/`)   |
| **State Management**  | React Context            | Jotai + Constate                   |
| **Media Serving**     | Hono `serveStatic` (Bun) | Dedicated Caddy Server             |
| **Database Schema**   | `ext` field              | `cover` field with image slug/name |
| **Request Routing**   | Client ➔ Server          | Client ➔ Caddy ➔ Server            |

## Breaking Changes

- **Unified Gallery**: Replaced `ImgSet` and `VideoSet` with a common `Gallery` type.
- **Media Support**: Now supports **audio** and **txt** types.

To see the new media types structure, check out the [TagApp Server Reference](./Notes/TagApp%20Server%20Reference.md).

## References

### MonoRepo Setup

- [ORPC monorepo setup reference](https://github.com/middleapi/orpc-multiservice-monorepo-playground/tree/main)
