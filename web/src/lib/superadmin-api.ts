"use client";

import { ApiError } from "@/lib/api";
import { clearSaSession } from "@/lib/superadmin-store";

export interface SaFetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function onSessionExpired() {
  clearSaSession();
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
}

// Single-flight superadmin refresh: concurrent 401s / scheduled refreshes share
// one rotation (the backend rotates the refresh token on every use).
let refreshPromise: Promise<boolean> | null = null;

export function refreshSaSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/superadmin/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedules a superadmin refresh shortly before the access cookie expires. */
export function scheduleSaRefresh(expiresInSeconds?: number) {
  if (typeof window === "undefined") return;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  const seconds = expiresInSeconds ?? 15 * 60;
  const delay = Math.max(5_000, (seconds - 60) * 1000);
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    void refreshSaSession().then((ok) => {
      if (ok) scheduleSaRefresh(seconds);
      else onSessionExpired();
    });
  }, delay);
}

function refreshIfStale() {
  if (typeof window === "undefined") return;
  if (document.visibilityState !== "visible") return;
  // Cheap heuristic: the access cookie can't be read here, so refresh on every
  // resume and treat a rejection as a real session end.
  void refreshSaSession().then((ok) => {
    if (ok) scheduleSaRefresh();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("focus", refreshIfStale);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshIfStale();
  });
}

export async function saFetch<T = unknown>(path: string, opts: SaFetchOptions = {}): Promise<T> {
  const url = `${path}`;
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };

  const doFetch = () =>
    fetch(url, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      // The superadmin credential is an httpOnly cookie, so it must be sent
      // explicitly. No Authorization header is attached by design.
      credentials: "include",
    });

  let res = await doFetch();

  if (res.status === 401) {
    // Try the sliding refresh once before giving up on the session.
    const ok = await refreshSaSession();
    if (ok) {
      res = await doFetch();
    }
    if (res.status === 401) {
      onSessionExpired();
      throw new ApiError(401, "UNAUTHORIZED", "Session expired");
    }
  }

  if (res.status === 204) return undefined as T;

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      String(data.code ?? "ERROR"),
      String(data.error ?? data.message ?? `HTTP ${res.status}`),
      data.details as Record<string, unknown> | undefined,
    );
  }

  return data as unknown as T;
}
