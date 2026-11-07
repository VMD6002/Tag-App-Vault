import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Server port default (packages/api/src/db/settings.ts) and the Caddy site that serves /media (apps/Caddyfile)
const SERVER = "http://localhost:5001";
const CADDY = "http://localhost:5000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // The oRPC client and media URLs are same-origin, so `bun dev:web` forwards them to a running server
  server: {
    proxy: {
      "/rpc": SERVER,
      "/media": CADDY,
    },
  },
  build: {
    outDir: "../server/dist/WebUI",
  },
});
