"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, isAbortError } from "@/lib/api";
import type { ExpiringProduct } from "@/lib/types";

export interface ExpiryAlertData {
  expired: ExpiringProduct[];
  expiringSoon: ExpiringProduct[];
  warningDays: number;
}

interface State {
  data: ExpiryAlertData | null;
  loading: boolean;
}

const EMPTY: ExpiryAlertData = { expired: [], expiringSoon: [], warningDays: 30 };

/**
 * Loads the store's expired + near-expiry products for the expiry alert.
 *
 * `storageKeySuffix` scopes the per-session dismissal: the dashboard dialog and
 * the inventory banner dismiss independently but both remember the choice for
 * the rest of the browser session (sessionStorage), so the alert does not
 * re-pop on every navigation or poll.
 */
export function useExpiryAlert(storageKeySuffix = "default") {
  const [state, setState] = useState<State>({ data: null, loading: true });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(`expiry-alert-dismissed:${storageKeySuffix}`) === "1";
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await apiFetch<ExpiryAlertData>("/api/products/expiring", { signal, timeoutMs: 15000 });
      setState({ data: res, loading: false });
    } catch (err) {
      if (isAbortError(err)) return;
      // A failed alert fetch must never block the page; fail silent.
      setState({ data: EMPTY, loading: false });
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
      window.sessionStorage.setItem(`expiry-alert-dismissed:${storageKeySuffix}`, "1");
    }
  }, [storageKeySuffix]);

  const data = state.data ?? EMPTY;
  const total = data.expired.length + data.expiringSoon.length;

  return {
    data,
    loading: state.loading,
    total,
    hasAlerts: total > 0,
    dismissed,
    dismiss,
    reload: () => load(),
  };
}
