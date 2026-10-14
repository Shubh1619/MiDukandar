"use client";

import { create } from "zustand";

export interface SuperadminUser {
  id: string;
  email: string;
  name: string;
}

interface SuperadminState {
  ready: boolean;
  user: SuperadminUser | null;
  init: () => Promise<void>;
  setSession: (user: SuperadminUser) => void;
  logout: () => Promise<void>;
}

// Pre-H1 storage keys. The superadmin JWT used to live here, which meant any
// XSS payload could read it straight out of localStorage. The credential now
// lives only in an httpOnly cookie, so these are deleted on first load.
const LEGACY_KEYS = ["mz_sa_token", "mz_sa_user", "mz_sa_expires_at"] as const;

function purgeLegacyStorage() {
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearSaSession() {
  purgeLegacyStorage();
}

/**
 * Authenticates a superadmin request from the httpOnly `mz_sa` cookie.
 *
 * Deliberately a bare `fetch` rather than `saFetch`: `superadmin-api.ts`
 * imports `clearSaSession` from this module, and reusing `saFetch` here would
 * create an import cycle. The endpoint and cookie contract are the same.
 */
async function whoAmI(): Promise<SuperadminUser | null> {
  try {
    const res = await fetch("/api/superadmin/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { superadmin?: SuperadminUser };
    return data.superadmin ?? null;
  } catch {
    // Network failure is treated as "no session" rather than blocking the UI.
    return null;
  }
}

export const useSaAuth = create<SuperadminState>((set) => ({
  ready: false,
  user: null,

  // Called on mount by the superadmin gate. The session survives a page reload
  // because it is reconstructed from the cookie, not from stored JavaScript.
  init: async () => {
    purgeLegacyStorage();
    set({ user: await whoAmI(), ready: true });
  },

  setSession: (user) => {
    set({ user, ready: true });
  },

  logout: async () => {
    try {
      await fetch("/api/superadmin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Clear the client state regardless: a failed request must not leave the
      // UI showing a signed-in shell.
    }
    purgeLegacyStorage();
    set({ user: null, ready: true });
  },
}));
