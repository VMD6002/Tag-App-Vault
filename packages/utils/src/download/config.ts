import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Config {
  userAgent: string;
  retryDelayMinutes: number;
}

export const DEFAULT_CONFIG: Config = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  retryDelayMinutes: 5,
};

const write = (path: string, data: object) =>
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

/** Reads `config.json`, creating it with defaults if missing. Throws on invalid JSON (the file is left untouched). */
export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    write(path, DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    throw new Error(`Invalid JSON in ${path}: ${(e as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error(`${path} must contain a JSON object`);

  const r = raw as Record<string, unknown>;
  // A missing or wrongly typed key falls back to its default.
  const config: Config = {
    userAgent:
      typeof r.userAgent === "string" && r.userAgent.trim()
        ? r.userAgent
        : DEFAULT_CONFIG.userAgent,
    retryDelayMinutes:
      typeof r.retryDelayMinutes === "number" && r.retryDelayMinutes > 0
        ? r.retryDelayMinutes
        : DEFAULT_CONFIG.retryDelayMinutes,
  };
  // Only fill in missing keys; never rewrite values the user set.
  if (Object.keys(DEFAULT_CONFIG).some((k) => !(k in r)))
    write(path, { ...DEFAULT_CONFIG, ...r });
  return config;
}
