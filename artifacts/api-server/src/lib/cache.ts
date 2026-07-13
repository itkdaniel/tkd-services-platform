/**
 * Minimal in-process TTL cache shared across route modules.
 *
 * Feature-engineering reads (especially the graph query, which joins across
 * tables/entries/relations) are read-heavy and re-run on every graph pan or
 * search keystroke, so caching them cheaply matters for latency/throughput.
 * This is intentionally simple (no Redis/pub-sub) for the first build — see
 * README "Roadmap" for the distributed-cache upgrade path.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 15_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drop every cache entry whose key starts with `prefix`. Call after any write. */
export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClearAll(): void {
  store.clear();
}
