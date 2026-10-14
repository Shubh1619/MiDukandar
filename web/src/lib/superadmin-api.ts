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

export async function saFetch<T = unknown>(path: string, opts: SaFetchOptions = {}): Promise<T> {
  const url = `${path}`;
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    // The superadmin credential is an httpOnly cookie, so it must be sent
    // explicitly. No Authorization header is attached by design.
    credentials: "include",
  });

  if (res.status === 401) {
    onSessionExpired();
    throw new ApiError(401, "UNAUTHORIZED", "Session expired");
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