import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const API_PORT = process.env.API_PORT ?? "5000";

// httpOnly session cookies, one per area (see backend config.ts). The tenant
// refresh cookie is never issued to a superadmin and vice versa, so the two
// areas must be guarded by their own cookie.
const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "mz_refresh";
const SUPERADMIN_COOKIE = process.env.SUPERADMIN_COOKIE_NAME ?? "mz_sa";

// The superadmin console is its own auth realm: signing in sets only the
// superadmin cookie. Guarding it with the tenant refresh cookie bounced every
// freshly-signed-in superadmin (login returned 200, then the dashboard
// redirect went straight back to /login).
const SUPERADMIN_PREFIXES = ["/superadmin"];

// Tenant app screens.
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
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

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

  // Optimistic server-side guard for authenticated screens: redirect to /login
  // when the area's session cookie is absent. The real check still happens in
  // the API and the client-side gate; this only avoids rendering a shell that
  // cannot load any data.
  const toLogin = () => {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  };

  if (
    SUPERADMIN_PREFIXES.some((p) => underPrefix(pathname, p)) &&
    !request.cookies.get(SUPERADMIN_COOKIE)
  ) {
    return toLogin();
  }

  if (
    PROTECTED_PREFIXES.some((p) => underPrefix(pathname, p)) &&
    !request.cookies.get(REFRESH_COOKIE)
  ) {
    return toLogin();
  }

  return NextResponse.next();
}

export const config = {
  // API proxy plus every page route that is not a static asset (paths with a
  // dot, e.g. robots.txt or .png, are served directly and skipped).
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};