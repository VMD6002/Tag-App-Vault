import { GroupSchema, type GroupType } from "./types/group";

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

/**
 * Group records from the extension's `TAG_APP_INJECT_TAGS` message (`groups`, optional). Untrusted
 * like `covers`: entries that are not a valid `GroupSchema` record (or have an empty id) are dropped,
 * the first record of an id wins, and a cover that is not an absolute http(s) URL is dropped from its
 * record (the group stays). Keyed by id.
 */
export function parseInjectedGroups(value: unknown): Record<string, GroupType> {
  if (!Array.isArray(value)) return {};
  const out = new Map<string, GroupType>();
  for (const raw of value) {
    const parsed = GroupSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.id || out.has(parsed.data.id)) continue;
    const { cover, ...group } = parsed.data;
    const validCover = parseTagCovers({ cover }).cover;
    out.set(group.id, validCover ? { ...group, cover: validCover } : group);
  }
  return Object.fromEntries(out);
}
