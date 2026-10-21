"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, isAbortError } from "@/lib/api";

export interface LowStockItem {
  id: string;
  name: string;
  balance: number;
  minStock: number;
}

interface State {
  items: LowStockItem[];
  loading: boolean;
}

/**
 * Loads products whose stock balance has fallen below their minimum level.
 *
 * `storageKeySuffix` scopes the per-session dismissal so the dashboard popup
 * and the products banner dismiss independently but both stay dismissed for the
 * rest of the browser session (sessionStorage) — matching the expiry alert.
 */
export function useLowStockAlert(storageKeySuffix = "default") {
  const [state, setState] = useState<State>({ items: [], loading: true });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(`low-stock-alert-dismissed:${storageKeySuffix}`) === "1";
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch<{ count: number; items: LowStockItem[] }>("/api/inventory/stock/low", {
        signal,
        timeoutMs: 15000,
      });
      setState({ items: res.items ?? [], loading: false });
    } catch (err) {
      if (isAbortError(err)) return;
      // A failed alert fetch must never block the page; fail silent.
      setState({ items: [], loading: false });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`low-stock-alert-dismissed:${storageKeySuffix}`, "1");
    }
  }, [storageKeySuffix]);

  return {
    items: state.items,
    loading: state.loading,
    count: state.items.length,
    hasAlerts: state.items.length > 0,
    dismissed,
    dismiss,
    reload: () => load(),
  };
}
