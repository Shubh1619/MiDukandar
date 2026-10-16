import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// HSTS and `upgrade-insecure-requests` are only safe when the app is actually
// reached over TLS. Keying them off `isDev` alone is wrong: the production
// image is also what self-hosted plain-HTTP deployments run (the bundled
// docker-compose maps 3000 straight to HTTP), and the backend explicitly
// supports those via REFRESH_COOKIE_SECURE=false. A browser honours
// `upgrade-insecure-requests` on an http:// page, so it would rewrite every
// same-origin asset request to https:// and leave the app unable to load.
//
// Derive it from APP_URL instead: an https:// public URL means TLS is
// terminated in front of us and the strict headers are correct. Anything else
// (http, localhost, unset) omits them. Set APP_URL to your https origin to
// enable.
const publicUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
const tlsExpected = publicUrl.startsWith("https://");

// Next.js emits an inline bootstrap script for hydration, so a CSP without a
// nonce must allow 'unsafe-inline' for scripts. Moving to a per-request nonce
// (which would remove it) requires threading a nonce through src/proxy.ts —
// deliberately out of scope here. 'unsafe-eval' is only needed by the dev
// server's HMR runtime and is omitted from production builds.
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // Tailwind v4 injects a <style> block at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // next/font self-hosts the woff2 files, so fonts never leave 'self'.
  "font-src 'self' data:",
  // The API is same-origin (proxied via /api/*), but ws: is required for the
  // dev server's HMR socket.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Clickjacking defence, alongside X-Frame-Options below.
  "frame-ancestors 'none'",
  ...(tlsExpected ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  },
  // HSTS is always sent. It is a no-op when the app is served over plain HTTP
  // (browsers only honour it on https), so sending it on a local/HTTP
  // deployment is harmless, while omitting it meant TLS-terminated deployments
  // that forgot APP_URL shipped without HSTS. The genuinely unsafe directive —
  // CSP `upgrade-insecure-requests` — stays gated on tlsExpected below.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  redirects: async () => [
    { source: "/inventory", destination: "/products", permanent: true },
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
