/**
 * Tag -> cover URL map from the extension's `TAG_APP_INJECT_TAGS` message (`covers`).
 * The message comes from the page's window, so it is untrusted: anything that is not a plain
 * string -> absolute http(s) URL entry is dropped (no `javascript:`, `data:`, relative paths).
 */
export function parseTagCovers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [tag, url] of Object.entries(value)) {
    if (typeof url !== "string") continue;
    try {
      const { protocol } = new URL(url);
      if (protocol === "http:" || protocol === "https:") out[tag] = url;
    } catch {
      // not a URL
    }
  }
  return out;
}
