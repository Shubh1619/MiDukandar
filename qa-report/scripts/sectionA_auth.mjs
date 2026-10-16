// Section A - Authentication & session
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const accounts = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const OWNER = "owner@midukandar.demo";

async function otpLogin(email) {
  await api("POST", "/auth/otp/request", { body: { email, purpose: "LOGIN" } });
  return api("POST", "/auth/otp/verify", { body: { email, otp: "000000", purpose: "LOGIN" } });
}

await t("A01", "Health endpoint returns ok", async () => {
  const r = await http("GET", `${API}/health`);
  return { pass: r.status === 200 && r.json?.status === "ok", expected: '200 {status:"ok"}', actual: `${r.status} ${r.text}` };
});

await t("A02", "login-kind: tenant email -> tenant", async () => {
  const r = await api("POST", "/auth/login-kind", { body: { identifier: OWNER } });
  return { pass: r.status === 200 && r.json?.kind === "tenant", expected: '200 {kind:"tenant"}', actual: `${r.status} ${r.text}` };
});

await t("A03", "login-kind: superadmin email -> superadmin", async () => {
  const r = await api("POST", "/auth/login-kind", { body: { identifier: "superadmin@midukandar.com" } });
  return { pass: r.status === 200 && r.json?.kind === "superadmin", expected: '200 {kind:"superadmin"}', actual: `${r.status} ${r.text}` };
});

await t("A04", "login-kind: unknown email -> tenant (no enumeration)", async () => {
  const r = await api("POST", "/auth/login-kind", { body: { identifier: "nobody-qa@example.com" } });
  return { pass: r.status === 200 && r.json?.kind === "tenant", expected: '200 {kind:"tenant"}', actual: `${r.status} ${r.text}` };
});

await t("A05", "OTP request unknown email (LOGIN) leaks account existence (404 vs 200)", async () => {
  const r = await api("POST", "/auth/otp/request", { body: { email: "no-such-user-qa@example.com", purpose: "LOGIN" } });
  const known = await api("POST", "/auth/otp/request", { body: { email: OWNER, purpose: "LOGIN" } });
  return {
    pass: true,
    status: "WARN",
    severity: "low",
    expected: "Ideally identical response for existent/non-existent emails",
    actual: `unknown=${r.status} (${r.json?.code ?? r.json?.error ?? ""}), known=${known.status}`,
    notes: "Account enumeration: registered emails return 200, unknown return 404 with code ACCOUNT_NOT_FOUND.",
  };
});

await t("A06", "OTP request existing email does not return OTP in body", async () => {
  const r = await api("POST", "/auth/otp/request", { body: { email: OWNER, purpose: "LOGIN" } });
  const leaks = /"otp"\s*:|"devOtp"\s*:|"code"\s*:\s*"\d{4,8}"/.test(r.text ?? "");
  return {
    pass: !leaks,
    expected: "no OTP value in response body",
    actual: `status=${r.status} leaksOtp=${leaks}`,
    notes: leaks ? "OTP value returned in response body" : "",
    evidence: (r.text ?? "").slice(0, 200),
  };
});

await t("A07", "OTP verify wrong code -> 4xx", async () => {
  await api("POST", "/auth/otp/request", { body: { email: OWNER, purpose: "LOGIN" } });
  const r = await api("POST", "/auth/otp/verify", { body: { email: OWNER, otp: "111111", purpose: "LOGIN" } });
  return { pass: r.status >= 400 && r.status < 500, expected: "4xx", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("A08", "OTP verify short/malformed code -> 400", async () => {
  const r = await api("POST", "/auth/otp/verify", { body: { email: OWNER, otp: "x", purpose: "LOGIN" } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("A09", "OTP verify success -> accessToken + HttpOnly refresh cookie", async () => {
  const v = await otpLogin(OWNER);
  const cookie = v.setCookie.find((c) => /mz_refresh/.test(c)) ?? "";
  const httpOnly = /HttpOnly/i.test(cookie);
  const sameSite = /SameSite=/i.test(cookie);
  return {
    pass: v.status === 200 && !!v.json?.accessToken && httpOnly && sameSite,
    expected: "200 + accessToken + HttpOnly+SameSite refresh cookie",
    actual: `${v.status}, token=${!!v.json?.accessToken}, cookiePresent=${!!cookie}, HttpOnly=${httpOnly}, SameSite=${sameSite}`,
    evidence: cookie.replace(/mz_refresh=[^;]+/, "mz_refresh=<redacted>"),
  };
});

await t("A10", "GET /auth/me -> user, store, permissions, plan", async () => {
  const r = await api("GET", "/auth/me", { token: accounts.store1.owner.token });
  return {
    pass: r.status === 200 && r.json?.user?.email === OWNER && !!r.json?.store,
    expected: "200 with user/store/plan",
    actual: `${r.status} email=${r.json?.user?.email} role=${r.json?.user?.role} store=${r.json?.store?.name} plan=${r.json?.plan?.name}`,
  };
});

await t("A11", "/auth/me without token -> 401", async () => {
  const r = await api("GET", "/auth/me");
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A12", "/auth/me with tampered signature -> 401", async () => {
  const tok = accounts.store1.owner.token.replace(/.$/, (c) => (c === "a" ? "b" : "a"));
  const r = await api("GET", "/auth/me", { token: tok });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A13", "Authorization header without Bearer scheme -> 401", async () => {
  const r = await http("GET", `${API}/api/auth/me`, { headers: { authorization: accounts.store1.owner.token } });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A14", "Superadmin cookie cannot access tenant API", async () => {
  const r = await http("GET", `${API}/api/auth/me`, { headers: { cookie: accounts.superadmin.cookieValue } });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A15", "Tenant token cannot access superadmin API", async () => {
  const r = await api("GET", "/superadmin/tenants", { token: accounts.store1.owner.token });
  return { pass: r.status === 401 || r.status === 403, expected: "401/403", actual: `${r.status}` };
});

await t("A16", "Refresh (cookie) rotates token + issues new cookie", async () => {
  const cookie = accounts.store1.owner.refreshCookie;
  const r = await http("POST", `${API}/api/auth/refresh`, { headers: { cookie }, body: {} });
  const newCookie = r.setCookie.find((c) => /mz_refresh/.test(c)) ?? "";
  return {
    pass: r.status === 200 && !!r.json?.accessToken && !!newCookie && newCookie !== cookie,
    expected: "200 + rotated cookie",
    actual: `${r.status} token=${!!r.json?.accessToken} rotated=${!!newCookie && newCookie !== cookie}`,
  };
});

await t("A17", "Refresh with no token -> 401", async () => {
  const r = await http("POST", `${API}/api/auth/refresh`, { body: {} });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A18", "Logout revokes refresh token (further refresh -> 401)", async () => {
  const lg = await otpLogin(OWNER);
  const cookie = lg.setCookie.find((c) => /mz_refresh/.test(c));
  const out = await http("POST", `${API}/api/auth/logout`, { headers: { cookie } });
  const after = await http("POST", `${API}/api/auth/refresh`, { headers: { cookie }, body: {} });
  return { pass: out.status === 200 && after.status === 401, expected: "logout 200, refresh 401", actual: `logout=${out.status} refresh=${after.status}` };
});

await t("A19", "Register duplicate email -> 409", async () => {
  const r = await api("POST", "/auth/register", { body: { email: OWNER, ownerName: "Dup", name: "Dup", type: "Kirana" } });
  return { pass: r.status === 409, expected: "409", actual: `${r.status}` };
});

await t("A20", "Register invalid email -> 400", async () => {
  const r = await api("POST", "/auth/register", { body: { email: "not-an-email", ownerName: "X", name: "X", type: "Kirana" } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("A21", "Superadmin login wrong password -> 401", async () => {
  const r = await api("POST", "/superadmin/auth/login", { body: { email: "superadmin@midukandar.com", password: "wrong-password" } });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("A22", "No tenant password-login route exposed (OTP only)", async () => {
  const r = await api("POST", "/auth/login", { body: { email: OWNER, password: "whatever" } });
  return { pass: r.status >= 400, expected: "4xx (route absent)", actual: `${r.status}` };
});

console.log("\nSection A complete.");
