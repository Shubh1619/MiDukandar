// Section F - Web surface, headers, CORS, i18n
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, WEB, DATA_DIR, http, t } from "./lib.mjs";

const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));

const secHeaders = (h) => ({
  hsts: h["strict-transport-security"] ?? "",
  csp: h["content-security-policy"] ?? "",
  xfo: h["x-frame-options"] ?? "",
  nosniff: h["x-content-type-options"] ?? "",
  referrer: h["referrer-policy"] ?? "",
  permissions: h["permissions-policy"] ?? "",
});

await t("F01", "Web home returns 200", async () => {
  const r = await http("GET", `${WEB}/`);
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("F02", "Web login page renders 200", async () => {
  const r = await http("GET", `${WEB}/login`);
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("F03", "Web pricing page renders 200", async () => {
  const r = await http("GET", `${WEB}/pricing`);
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("F04", "Unauthenticated /dashboard redirects to login", async () => {
  const r = await http("GET", `${WEB}/dashboard`, { redirect: "manual" });
  const loc = r.headers["location"] ?? "";
  return { pass: (r.status === 307 || r.status === 302 || r.status === 308) && /login|signin|auth/i.test(loc), expected: "3xx -> /login", actual: `${r.status} loc=${loc}` };
});

await t("F05", "Web sets security headers", async () => {
  const r = await http("GET", `${WEB}/`);
  const s = secHeaders(r.headers);
  const missing = Object.entries(s).filter(([, v]) => !v).map(([k]) => k);
  return { pass: missing.length === 0, expected: "HSTS, CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy", actual: `missing=${missing.join(",") || "none"}`, evidence: JSON.stringify(s), severity: "medium", notes: "Missing browser hardening headers on the web app." };
});

await t("F06", "API responses set X-Content-Type-Options nosniff", async () => {
  const r = await http("GET", `${API}/api/plans`);
  return { pass: r.headers["x-content-type-options"] === "nosniff", expected: "nosniff", actual: `${r.headers["x-content-type-options"] ?? "absent"}`, severity: "low" };
});

await t("F07", "CORS: API does not reflect arbitrary Origin with credentials", async () => {
  const r = await http("GET", `${API}/api/plans`, { headers: { origin: "https://evil.example.com" } });
  const acao = r.headers["access-control-allow-origin"] ?? "";
  const acac = r.headers["access-control-allow-credentials"] ?? "";
  const bad = acao === "https://evil.example.com" || acao === "*";
  return { pass: !bad, expected: "no ACAO reflection for untrusted origin", actual: `ACAO=${acao || "none"} ACAC=${acac || "none"}`, severity: "high" };
});

await t("F08", "CORS preflight from untrusted origin not permissive", async () => {
  const r = await http("OPTIONS", `${API}/api/products`, { headers: { origin: "https://evil.example.com", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" } });
  const acao = r.headers["access-control-allow-origin"] ?? "";
  return { pass: !(r.status === 204 && (acao === "*" || /evil\.example/.test(acao))), expected: "preflight blocked/rejected", actual: `${r.status} ACAO=${acao || "none"}` };
});

await t("F09", "API docs/swagger not publicly exposed", async () => {
  const paths = ["/docs", "/swagger", "/api-docs", "/swagger.json", "/openapi.json"];
  const hits = [];
  for (const p of paths) {
    const r = await http("GET", `${API}${p}`);
    if (r.status === 200) hits.push(`${p}:${r.status}`);
  }
  return { pass: hits.length === 0, expected: "no public API schema/docs", actual: hits.length ? `exposed: ${hits.join(", ")}` : "none", severity: "low" };
});

await t("F09b", "robots.txt present", async () => {
  const r = await http("GET", `${WEB}/robots.txt`);
  return { pass: r.status === 200, expected: "200", actual: `${r.status}`, severity: "low" };
});

await t("F10", "Health endpoint ok", async () => {
  const r = await http("GET", `${API}/health`);
  return { pass: r.status === 200 && r.json?.status === "ok", expected: "200 ok", actual: `${r.status} ${r.json?.status}` };
});

await t("F11", "API auth/me rejects missing token -> 401", async () => {
  const r = await http("GET", `${API}/api/auth/me`);
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("F12", "API auth/me rejects malformed token -> 401", async () => {
  const r = await http("GET", `${API}/api/auth/me`, { token: "not.a.jwt" });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

// ---- mobile: manual ----
const manual = (id, title, notes) => t(id, title, async () => ({ pass: false, status: "MANUAL", expected: "manual check", actual: "not automatable", notes }));
await manual("F13", "Mobile app: full manual pass required", "Flutter app (app/) has no integration_test/Playwright. Needs a device/emulator: onboarding, OTP login, invoice create + hold/resume, invoice PDF share, reports P&L/GST, supplier payment history, referral sheet. Not automatable in this environment.");
await manual("F14", "Cross-device responsive check", "Verify web layout at 360px/768px/1280px and mobile in portrait/landscape.");

console.log("\nSection F complete.");
