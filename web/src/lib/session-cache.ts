/**
 * Tiny session-scoped cache for data that changes rarely (categories, units,
 * GST options, store settings). Kept in memory only — no persistence — so
 * fresh logins always start clean. Callers invalidate after mutations that
 * could change the cached payload.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.value as T);
  }
  return fetcher()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
}

export function invalidateCache(...keys: string[]): void {
  for (const key of keys) cache.delete(key);
}