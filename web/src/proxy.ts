import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const API_PORT = process.env.API_PORT ?? "5000";

// httpOnly refresh cookie shared with the API (see backend config.ts). Its
// presence is an optimistic signal that the user has a live session; the
// absence of it means an unauthenticated visitor.
const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "mz_refresh";

// Authenticated app screens. Hitting one without a session cookie is redirected
// to /login at the edge, so unauthenticated users never receive the workspace
// shell (the client-side AuthGate remains as a second line of defence).
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/products",
  "/customers",
  "/suppliers",
  "/invoices",
  "/inventory",
  "/payments",
  "/expenses",
  "/reports",
  "/settings",
  "/users",
  "/udhaari",
  "/purchases",
  "/superadmin",
];

// In the combined single-container image the Fastify API runs on loopback at
// 127.0.0.1:API_PORT (see Dockerfile `production`). If BACKEND_URL is ever set
// to this app's own public origin, rewriting /api/* to it sends the request out
// through the internet and back into this same server, which rewrites it again
// forever — Render's edge then aborts with "508 Loop Detected". Detect that
// self-reference and fall back to the loopback API instead of looping.
function backendOriginFor(request: NextRequest): string {
  let backend: URL;
  try {
    backend = new URL(BACKEND_URL);
  } catch {
    return BACKEND_URL;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost =
    (forwardedHost ? forwardedHost.split(",")[0].trim() : null) ??
    request.headers.get("host") ??
    request.nextUrl.host;

  return backend.host === requestHost ? `http://127.0.0.1:${API_PORT}` : BACKEND_URL;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const target = new URL(`${pathname}${search}`, backendOriginFor(request));
    // Forward the caller's Origin untouched. The Fastify API's CORS handler
    // allows same-origin, the configured allow-list, and any localhost port
    // (Flutter web dev). Stripping the header here broke cross-origin
    // preflight requests: @fastify/cors rejects an OPTIONS without Origin.
    return NextResponse.rewrite(target);
  }

  // Optimistic server-side guard for authenticated screens.
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !request.cookies.get(REFRESH_COOKIE)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // API proxy plus every page route that is not a static asset (paths with a
  // dot, e.g. robots.txt or .png, are served directly and skipped).
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};