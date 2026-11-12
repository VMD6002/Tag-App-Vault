import { networkInterfaces } from "node:os";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import {
  contentSyncSchema,
  downloadsSetSchema,
  groupsDB,
  overwriteContent,
  router,
  setDownloads,
  settingsDB,
} from "@tagapp/api";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { trimTrailingSlash } from "hono/trailing-slash";
import createAppDirs from "./lib/createAppDirs.js";

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      // Skip loopback (127.0.0.1) and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// Port and prefix come from settings.json (edit the file to change them)
const activePort = settingsDB.data.port;
const activePrefix = settingsDB.data.prefix;

createAppDirs();
await groupsDB.write(); // DB/groups.json exists from the first start

const app = new Hono();
app.use(logger());
app.use(trimTrailingSlash());
app.use(
  cors({
    origin: "*",
    allowHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 3600,
  }),
);

app.post("/content/sync", async (c) =>
  c.json(await overwriteContent(contentSyncSchema.parse(await c.req.json()))),
);

app.post("/downloads/set", async (c) =>
  c.json(await setDownloads(downloadsSetSchema.parse(await c.req.json()))),
);

// oRPC hides a procedure's exception behind a bare 500: print it
const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});
app.use("/rpc/*", async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/rpc",
    context: {}, // Provide initial context if needed
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

// 2. Catch Vite's static assets requested at the root
app.use(
  "/assets/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => `/WebUI${path}`,
  }),
);

// 3. Catch the favicon
app.use(
  "/favicon.ico",
  serveStatic({
    path: "./WebUI/favicon.ico",
  }),
);

// 4. Map static files to the dynamically configured prefix
app.use(
  `${activePrefix}/*`,
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) =>
      path.replace(new RegExp(`^${activePrefix}`), "/WebUI"),
  }),
);

// 5. The SPA Fallback (bound to the active prefix)
app.get(`${activePrefix}`, serveStatic({ path: "./WebUI/index.html" }));
app.get(`${activePrefix}/*`, serveStatic({ path: "./WebUI/index.html" }));

const localIP = getLocalIP();
console.log(`Server active on:`);
console.log(`  - Local:   http://localhost:${activePort}${activePrefix}`);
console.log(`  - Network: http://${localIP}:${activePort}${activePrefix}`);
console.log(`  - RPC API: http://localhost:${activePort}/rpc`);

export default {
  port: activePort,
  fetch: app.fetch,
  hostname: "0.0.0.0",
};
