/**
 * A tiny in-process TTL cache. Entries are dropped after `ttlMs` and the map is
 * swept lazily on access, so it never grows without bound for a small number of
 * hot keys (e.g. one dashboard summary per store).
 *
 * This is deliberately per-process: it is a short-lived read cache for
 * expensive-but-idempotent aggregates, not a source of truth. Callers must pass
 * values that are cheap to recompute after eviction.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (v.expiresAt <= now) this.store.delete(k);
      }
      // Still full: drop the oldest inserted entry (Map preserves insertion order).
      if (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next().value;
        if (oldest !== undefined) this.store.delete(oldest);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Returns the cached value, or computes + stores it on a miss. */
  async wrap(key: string, compute: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }

  /** Removes every entry whose key starts with `prefix`. */
  deleteKeysWithPrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
