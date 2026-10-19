import { create } from "zustand";
import { apiFetch, setAccessToken, clearSession, refreshAccessToken } from "./api";
import { getImpersonation, clearImpersonation, decodeJwtPayload } from "./impersonation";
import { broadcastLogout, broadcastRestored, subscribeCrossTab } from "./cross-tab";
import type { PermissionMap, StoreAccess } from "./types";
import type { PlanDefinition } from "./plan-catalog";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: "OWNER" | "CASHIER" | "MANAGER" | "STAFF" | "STOCK_MANAGER";
  storeId: string | null;
  permissions?: Partial<PermissionMap>;
  access?: StoreAccess;
}

export interface StoreInfo {
  id: string;
  name: string;
  type: string;
  gst: string | null;
  currency: string;
  language: string;
  invoicePrefix: string;
  planDetails?: PlanDefinition | null;
}

interface CachedAuth {
  user: AuthUser;
  store: StoreInfo | null;
  timestamp: number;
}

const CACHE_KEY = "midu:auth";
const CACHE_TTL = 24 * 60 * 60 * 1000;

function readCache(): CachedAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAuth;
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(user: AuthUser, store: StoreInfo | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user, store, timestamp: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

function clearCache() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CACHE_KEY);
}

interface AuthState {
  ready: boolean;
  user: AuthUser | null;
  store: StoreInfo | null;
  init: (force?: boolean) => Promise<void>;
  setUserAndTokens: (user: AuthUser, access: string) => void;
  setStore: (store: StoreInfo) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  store: null,

  /**
   * Silent session restore on app load (tab open/reopen/browser restart):
   * the httpOnly refresh cookie is exchanged for a fresh in-memory access
   * token, then the profile is fetched. No login screen is shown while the
   * refresh cookie remains valid — active sessions never expire on their own.
   *
   * Impersonation: the superadmin-issued token carries the staff claims, is
   * decodable client-side for display, and has no refresh path — so the user
   * identity is rebuilt from the token directly.
   */
  init: async (force?: boolean) => {
    if (get().ready && !force) return;

    // Hydrate from cache immediately for instant UI
    const cached = readCache();
    if (cached && !force) {
      set({ user: cached.user, store: cached.store, ready: true });
    } else {
      set({ ready: false });
    }

    const imp = getImpersonation();
    if (imp) {
      const token = imp.accessToken;
      const payload = decodeJwtPayload<{
        id?: string;
        sub?: string;
        email?: string;
        name?: string | null;
        role?: AuthUser["role"];
        storeId?: string | null;
        businessId?: string | null;
      }>(token);
      if (payload?.email) {
        setAccessToken(token);
        try {
          const me = await apiFetch<{ user: AuthUser; store: StoreInfo | null; plan: PlanDefinition | null }>("/api/auth/me");
          const storeWithPlan = me.store ? { ...me.store, planDetails: me.store.planDetails ?? me.plan } : null;
          writeCache(me.user, storeWithPlan);
          set({ user: me.user, store: storeWithPlan, ready: true });
          return;
        } catch {
          clearImpersonation();
          clearSession();
          clearCache();
          set({ user: null, store: null, ready: true });
          return;
        }
      }
      clearImpersonation();
    }

    // Single silent refresh on load — the access token the response returns is
    // stored in memory by refreshAccessToken itself. A server rejection ends
    // the session; a network/5xx failure keeps it alive (matches mobile).
    const outcome = await refreshAccessToken();
    if (outcome !== "success") {
      clearSession();
      clearCache();
      if (outcome === "rejected") {
        // Cookie expired/revoked → real session end, propagate to other tabs.
        broadcastLogout();
      }
      set({ user: null, store: null, ready: true });
      return;
    }

    try {
      const me = await apiFetch<{ user: AuthUser; store: StoreInfo | null; plan: PlanDefinition | null }>("/api/auth/me");
      const storeWithPlan = me.store ? { ...me.store, planDetails: me.store.planDetails ?? me.plan } : null;
      writeCache(me.user, storeWithPlan);
      set({ user: me.user, store: storeWithPlan, ready: true });
      broadcastRestored();
    } catch {
      // A successful refresh but a failed profile fetch (typically offline) is
      // NOT a revocation — don't broadcast and don't revoke anything; the next
      // page load retries against the still-valid cookie.
      clearSession();
      set({ user: null, store: null, ready: true });
    }
  },

  setUserAndTokens: (user, access) => {
    setAccessToken(access);
    writeCache(user, get().store);
    set({ user });
    broadcastRestored();
  },

  setStore: (store) => {
    const { user } = get();
    if (user) writeCache(user, store);
    set({ store });
  },

  setUser: (user) => {
    const { store } = get();
    if (store) writeCache(user, store);
    set({ user });
  },

  logout: () => {
    clearSession();
    clearCache();
    // Explicit logout — the ONLY user-driven session end. Other open tabs
    // clear their in-memory token and redirect to the login screen.
    broadcastLogout();
    set({ user: null, store: null });
  },
}));

// The API layer signals here when a refresh attempt fails (expired/revoked
// refresh token). Clear user state so AuthGate redirects to the login screen.
if (typeof window !== "undefined") {
  window.addEventListener("midu:auth-expired", () => {
    useAuth.setState({ user: null, store: null, ready: true });
  });

  // Cross-tab session propagation:
  //  - "auth:logout"   → another tab logged out / had its session revoked.
  //    The shared refresh cookie is already gone or dead; clear our in-memory
  //    token and state so AuthGate bounces this tab to /login too.
  //  - "auth:restored" → another tab restored/logged in. If this tab is
  //    parked logged-out (e.g. sitting on the login screen), adopt the shared
  //    cookie session by re-running the restore.
  subscribeCrossTab((event) => {
    if (event.type === "auth:logout") {
      clearSession();
      useAuth.setState({ user: null, store: null, ready: true });
    } else if (event.type === "auth:restored") {
      const { user, ready } = useAuth.getState();
      if (!user && ready) {
        void useAuth.getState().init(true);
      }
    }
  });
}
