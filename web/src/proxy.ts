import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const target = new URL(`${pathname}${search}`, BACKEND_URL);
    // Forward the caller's Origin untouched. The Fastify API's CORS handler
    // allows same-origin, the configured allow-list, and any localhost port
    // (Flutter web dev). Stripping the header here broke cross-origin
    // preflight requests: @fastify/cors rejects an OPTIONS without Origin.
    return NextResponse.rewrite(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};