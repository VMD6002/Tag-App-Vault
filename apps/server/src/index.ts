import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { trimTrailingSlash } from "hono/trailing-slash";
import { logger } from "hono/logger";

import { RPCHandler } from "@orpc/server/fetch";

import createAppDirs from "./lib/createAppDirs.js";
import { router, settings } from "@tagapp/api";
import { parseArgs } from "node:util";

const schema = {
  port: { type: "string" },
} as const;

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: schema,
  strict: true,
});

const { port } = values;

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

app.use(
  "/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => `/WebUI/${path}`,
  }),
);

// 4. The SPA Fallback (The very last thing)
app.get("*", serveStatic({ path: "./WebUI/index.html" }));

console.log(`Server active on http://0.0.0.0:${settings.port}`);

export default {
  port: port ?? settings.port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
};
