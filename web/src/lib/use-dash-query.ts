"use client";

import { useEffect, useState } from "react";

export interface DashQueryResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Lightweight data-fetching hook with optional polling and manual refresh.
 * State is only mutated inside async callbacks (never synchronously in the
 * effect body). Pass a memoized fetcher keyed on the active store id so a
 * store switch automatically refetches everything downstream.
 */
export function useDashQuery<T>(
  fetcher: () => Promise<T>,
  opts?: { pollMs?: number },
): DashQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const d = await fetcher();
        if (mounted) {
          setData(d);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setData(null);
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    if (opts?.pollMs && opts.pollMs > 0) {
      const id = setInterval(() => void run(), opts.pollMs);
      return () => {
        mounted = false;
        clearInterval(id);
      };
    }
    return () => {
      mounted = false;
    };
  }, [fetcher, opts?.pollMs, tick]);

  return {
    data,
    error,
    loading,
    refresh: () => setTick((t) => t + 1),
  };
}