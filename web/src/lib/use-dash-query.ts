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
    // Only the very first load shows the skeleton. Background polls and manual
    // refreshes keep the current data on screen so a single failed poll can't
    // blank the whole page.
    let hasLoaded = false;
    const run = async () => {
      try {
        const d = await fetcher();
        if (mounted) {
          setData(d);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Failed to load data";
          setError(message);
          // Preserve the last good payload unless we never had one.
          if (!hasLoaded) setData(null);
        }
      } finally {
        hasLoaded = true;
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
    refresh: () => {
      setLoading(true);
      setTick((t) => t + 1);
    },
  };
}