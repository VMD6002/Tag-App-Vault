import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { trimTrailingSlash } from "hono/trailing-slash";
import { logger } from "hono/logger";

import { RPCHandler } from "@orpc/server/fetch";

import createAppDirs from "./lib/createAppDirs.js";
import { router, settingsDB } from "@tagapp/api";
import { parseArgs } from "node:util";
import {
  contentWebSchema,
  type ContentWebType,
} from "../../../packages/utils/src/types/web.js";
import { writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";

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

// 1. Add prefix to your schema
const schema = {
  port: { type: "string" },
  prefix: { type: "string" },
} as const;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: schema,
  strict: true,
});

const { port, prefix } = values;

// --- Port Settings Logic ---
let activePort: number;
if (port && !settingsDB.data.port) {
  settingsDB.data.port = Number(port);
  settingsDB.write();
}
activePort = settingsDB.data.port || 5000;

// --- Prefix Settings Logic ---
if (prefix) {
  // Sanitize the flag input: ensure it starts with "/" and has no trailing "/"
  let cleanPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  cleanPrefix = cleanPrefix.replace(/\/$/, "");

  // Update DB if the flag was provided
  settingsDB.data.prefix = cleanPrefix;
  settingsDB.write();
}

// Read the active prefix from the DB, fallback to "/app" if never set
const activePrefix = settingsDB.data.prefix || "/app";

createAppDirs();

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

app.post("/downloads/set", async (c) => {
  const body = (await c.req.json()) as ContentWebType[];

  // const res = contentWebSchema.array().safeParse(body);
  const res = contentWebSchema.array().parse(body);

  await writeFile("./Download/tmp.json", JSON.stringify(res, null, 2), "utf-8");

  return c.json(res);
});

const handler = new RPCHandler(router);
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
