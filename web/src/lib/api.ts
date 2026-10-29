import { getImpersonation, clearImpersonation } from "./impersonation";
import { broadcastLogout } from "./cross-tab";
import { clearSessionCache } from "./session-cache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Combines an optional caller signal with an optional timeout into a single
 * derived AbortController so `apiFetch` callers can cancel stale requests and
 * never have slow responses overwrite newer ones.
 */
function makeSignal(signal?: AbortSignal, timeoutMs?: number): {
  signal: AbortSignal | undefined;
  cleanup: () => void;
} {
  if (!signal && !timeoutMs) return { signal: undefined, cleanup: () => {} };
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
    },
  };
}

// ---------------------------------------------------------------------------
// Token strategy
// ---------------------------------------------------------------------------
// The ACCESS token lives in memory ONLY (never localStorage) and is attached
// as `Authorization: Bearer`. The REFRESH token lives in an httpOnly Secure
// SameSite=Lax cookie on the API origin and is never visible to JS. `apiFetch`
// transparently refreshes the access token on 401 and retries once; the
// refresh itself is single-flight so concurrent 401s trigger exactly one call.
// A refresh only ends the session when the SERVER rejects the token —
// network/5xx failures keep the session alive (no silent logout).
// ---------------------------------------------------------------------------

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  scheduleProactiveRefresh();
}

/**
 * During an impersonation session the superadmin-issued access token (signed
 * with the tenant JWT secret) overrides the normal login token, and its own
 * localStorage record carries the remaining lifetime.
 */
function effectiveToken(): string | null {
  const imp = getImpersonation();
  if (imp) return imp.accessToken;
  return accessToken;
}

/** Clears in-memory token state plus any legacy localStorage leftovers. */
export function clearSession() {
  accessToken = null;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("mz_access");
    window.localStorage.removeItem("mz_refresh");
  }
  // Also drop the in-memory data cache so a new sign-in on this device never
  // sees the previous session's cached categories/units/settings.
  clearSessionCache();
}

export type RefreshOutcome = "success" | "rejected" | "network-error";

let refreshPromise: Promise<RefreshOutcome> | null = null;

/**
 * Exchange the httpOnly refresh cookie for a fresh access token. Single-flight:
 * concurrent callers share one in-flight request (needed because the backend
 * ROTATES the refresh token on every use — parallel refreshes would race).
 *
 * Outcome semantics (mirrors the mobile app):
 *  - "success"       → a new access token is stored in memory
 *  - "rejected"      → the server explicitly refused the token (expired,
 *                      revoked, inactive user) — the session is truly over
 *  - "network-error" → the server could not be reached / answered 5xx — NOT a
 *                      session-ender. The in-memory token is kept and the
 *                      original failure is surfaced; a later refresh attempt
 *                      (or page reload, on the shared cookie) recovers.
 */
const REFRESH_LOCK_NAME = "midukandar:token-refresh";

/**
 * Serializes the refresh across same-origin TABS. The backend rotates the
 * refresh cookie on every use, so two tabs refreshing at the same moment would
 * make one present an already-rotated token; the server answers 401 and the
 * loser used to broadcast a logout to every tab, wiping unsaved work. With the
 * Web Locks API the second tab starts only after the first has stored the new
 * cookie, so its refresh succeeds. Browsers without the API fall back to the
 * previous per-tab behaviour.
 */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return locks.request(REFRESH_LOCK_NAME, fn) as Promise<T>;
}

export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(performRefresh).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<RefreshOutcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return res.status === 401 || res.status === 403 ? "rejected" : "network-error";
    }
    const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (data?.accessToken) {
      accessToken = data.accessToken;
      scheduleProactiveRefresh();
      return "success";
    }
    return "network-error";
  } catch {
    return "network-error";
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Proactive refresh
// ---------------------------------------------------------------------------
// The access token is short-lived (~15 min). Relying on a 401 to trigger the
// refresh works but shows the user a transient failure on the very request
// that discovers expiry. Instead we refresh BEFORE the token lapses:
//   - a timer fires ~REFRESH_LEAD_MS before the token's `exp`, keeping the
//     session warm for an actively-used tab;
//   - returning to the tab (visibility/focus) refreshes immediately when the
//     token is at/near expiry, so a tab left open overnight is never stale on
//     the first click.
// Refresh itself is single-flight, so overlapping triggers are harmless.

const REFRESH_LEAD_MS = 60_000;

function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const pad = part.length % 4 ? "=".repeat(4 - (part.length % 4)) : "";
    const json = atob((part + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedules a single refresh just before the current access token expires. */
export function scheduleProactiveRefresh() {
  if (typeof window === "undefined") return;
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
  // Impersonation tokens have no refresh path — never schedule for them.
  if (getImpersonation() || !accessToken) return;
  const expMs = decodeJwtExpMs(accessToken);
  if (expMs == null) return;
  const delay = Math.max(5_000, expMs - Date.now() - REFRESH_LEAD_MS);
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    void refreshAccessToken().then((outcome) => {
      if (outcome === "rejected") onSessionExpired();
      else if (outcome === "success") scheduleProactiveRefresh();
    });
  }, delay);
}

/** Refreshes immediately if the token is missing/at/near expiry (used on resume). */
function refreshIfStale() {
  if (typeof window === "undefined" || getImpersonation()) return;
  if (!accessToken) return;
  const expMs = decodeJwtExpMs(accessToken);
  if (expMs == null) return;
  if (expMs - Date.now() <= REFRESH_LEAD_MS) {
    void refreshAccessToken().then((outcome) => {
      if (outcome === "rejected") onSessionExpired();
      else if (outcome === "success") scheduleProactiveRefresh();
    });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("focus", refreshIfStale);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshIfStale();
  });
}

/** Refresh token invalid/expired/revoked → the session is over. */
function onSessionExpired() {
  clearSession();
  if (typeof window === "undefined") return;
  // Impersonation is a token-scoped session, not a refresh-cookie session —
  // don't tell other tabs to end their sessions when an impersonation dies.
  if (!getImpersonation()) {
    broadcastLogout();
  }
  window.dispatchEvent(new Event("midu:auth-expired"));
  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
}

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  noAuth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { signal, cleanup } = makeSignal(opts.signal, opts.timeoutMs);
  try {
    const url = `${API_BASE}${path}`;
    const method = opts.method ?? (opts.body ? "POST" : "GET");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...opts.headers,
    };
    const token = effectiveToken();
    if (!opts.noAuth && token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const init: RequestInit = {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal,
      credentials: "include",
    };

    let res = await fetch(url, init);

    if (res.status === 401 && !opts.noAuth) {
      // Impersonation tokens cannot be refreshed — the session simply ends.
      if (getImpersonation()) {
        clearImpersonation();
        onSessionExpired();
        throw new ApiError(403, "IMPERSONATION_EXPIRED", "Impersonation session has expired.");
      }
      const outcome = await refreshAccessToken();
      if (outcome === "success" && accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
        res = await fetch(url, { ...init, headers });
      } else if (outcome === "rejected") {
        // Server refused the refresh token → real revocation, session is over.
        onSessionExpired();
      }
      // "network-error" keeps the session: fall through and surface the
      // original 401 without logging the user out.
    }

    if (res.status === 204) return undefined as T;

    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      // non-JSON
    }

    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "ERROR"), String(data.message ?? data.error ?? `HTTP ${res.status}`), data.details ?? data);
    }

    return data as unknown as T;
  } finally {
    cleanup();
  }
}

export { API_BASE };

export async function apiDownload(path: string, fallbackName = "download"): Promise<void> {
  // Re-reads the token on EVERY call so the 401 retry attaches the freshly
  // refreshed access token instead of the stale expired one.
  const doFetch = () => {
    const token = effectiveToken();
    return fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
  let res = await doFetch();
  if (res.status === 401) {
    if (getImpersonation()) {
      clearImpersonation();
      onSessionExpired();
      throw new ApiError(403, "IMPERSONATION_EXPIRED", "Impersonation session has expired.");
    }
    const outcome = await refreshAccessToken();
    if (outcome === "success" && accessToken) {
      res = await doFetch();
    } else if (outcome === "rejected") {
      onSessionExpired();
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = String(data.message ?? data.error ?? msg);
    } catch {
      // binary / non-json error body
    }
    throw new ApiError(res.status, "DOWNLOAD_ERROR", msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, String(data.code ?? "ERROR"), String(data.message ?? `HTTP ${res.status}`), data.details ?? data);
  }
  return data as unknown as T;
}

export async function apiUploadFile<T = unknown>(path: string, file: File, field = "file"): Promise<T> {
  // Re-reads the token on EVERY call so the 401 retry attaches the freshly
  // refreshed access token instead of the stale expired one.
  const doPost = () => {
    const form = new FormData();
    form.append(field, file);
    const headers: Record<string, string> = {};
    const token = effectiveToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form, credentials: "include" });
  };
  let res = await doPost();
  if (res.status === 401) {
    if (getImpersonation()) {
      clearImpersonation();
      onSessionExpired();
      throw new ApiError(403, "IMPERSONATION_EXPIRED", "Impersonation session has expired.");
    }
    const outcome = await refreshAccessToken();
    if (outcome === "success" && accessToken) {
      res = await doPost();
    } else if (outcome === "rejected") {
      onSessionExpired();
    }
  }
  return parseJson<T>(res);
}