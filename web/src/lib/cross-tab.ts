/**
 * Cross-tab auth events via BroadcastChannel.
 *
 * Sessions live in the browser: the refresh token is a shared httpOnly cookie
 * and the access token is per-tab in-memory state. When one tab logs out (or
 * gets a session revoked) the other tabs still hold a live access token unless
 * we tell them — so we broadcast an `auth:logout` event and they clear their
 * in-memory token and bounce to the login screen. Conversely, when a session
 * is successfully restored/logged-in in one tab we broadcast `auth:restored`
 * so tabs that currently sit logged-out can adopt the shared session.
 *
 * BroadcastChannel never echoes to the posting tab and is origin-scoped, which
 * is exactly what we want. If the API is unavailable we degrade to a no-op.
 */

const CHANNEL_NAME = "midukandar:auth";

type CrossTabEvent = { type: "auth:logout" } | { type: "auth:restored" };

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (channel === undefined) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

/** Tell every other tab that this session has ended. */
export function broadcastLogout() {
  try {
    getChannel()?.postMessage({ type: "auth:logout" } satisfies CrossTabEvent);
  } catch {
    // ignore — best effort
  }
}

/** Tell every other tab that a session is now active in this browser. */
export function broadcastRestored() {
  try {
    getChannel()?.postMessage({ type: "auth:restored" } satisfies CrossTabEvent);
  } catch {
    // ignore — best effort
  }
}

/** Subscribe to cross-tab auth events. Returns an unsubscribe function. */
export function subscribeCrossTab(handler: (event: CrossTabEvent) => void): () => void {
  const bc = getChannel();
  if (!bc) return () => {};
  const listener = (event: MessageEvent<CrossTabEvent>) => {
    if (event.data && typeof event.data === "object" && "type" in event.data) {
      handler(event.data);
    }
  };
  bc.addEventListener("message", listener);
  return () => bc.removeEventListener("message", listener);
}