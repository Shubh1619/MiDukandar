export interface ImpersonationSession {
  accessToken: string;
  tenantName: string;
  expiresAt: number;
  by: string;
}

const KEY = "mz_impersonation";

function parse(raw: string): ImpersonationSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationSession>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) return null;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    return parsed as ImpersonationSession;
  } catch {
    return null;
  }
}

export function getImpersonation(): ImpersonationSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const session = parse(raw);
    if (!session) window.localStorage.removeItem(KEY);
    return session;
  } catch {
    return null;
  }
}

export function isImpersonated(): boolean {
  return getImpersonation() !== null;
}

export function setImpersonation(session: ImpersonationSession) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearImpersonation() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Decodes a JWT payload without verifying (for display / local routing only). */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const part2 = token.split(".")[1];
    if (!part2) return null;
    const pad = part2.length % 4 ? "=".repeat(4 - (part2.length % 4)) : "";
    const json = window.atob((part2 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}