// Section E - Platform / superadmin console
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const saToken = A.store1.owner.token;

const login = await http("POST", `${API}/api/superadmin/auth/login`, { body: { email: "superadmin@midukandar.com", password: "admin@123" } });
const saCookie = (login.setCookie.find((c) => /^mz_sa=/.test(c)) ?? "").split(";")[0];
if (!saCookie) throw new Error("superadmin login failed: " + JSON.stringify(login.json));
const sa = { cookie: saCookie };

await t("E00", "Superadmin login (fresh token) succeeds", async () => ({
  pass: login.status === 200, expected: "200", actual: `${login.status}`,
}));

await t("E01", "Superadmin login sets HttpOnly mz_sa cookie", async () => {
  const r = await api("POST", "/superadmin/auth/login", { body: { email: "superadmin@midukandar.com", password: "admin@123" } });
  const c = r.setCookie.find((x) => /mz_sa/.test(x)) ?? "";
  return { pass: r.status === 200 && /HttpOnly/i.test(c), expected: "200 + HttpOnly mz_sa", actual: `${r.status} cookie=${c ? (/HttpOnly/i.test(c) ? "HttpOnly" : "not-httponly") : "none"}`, evidence: c.replace(/mz_sa=[^;]+/, "mz_sa=<redacted>") };
});

await t("E02", "Superadmin /me authenticated via cookie", async () => {
  const r = await api("GET", "/superadmin/auth/me", { headers: sa });
  return { pass: r.status === 200 && !!r.json?.email || !!r.json?.superadmin, expected: "200", actual: `${r.status} ${JSON.stringify(r.json).slice(0, 80)}` };
});

await t("E03", "Unauthenticated superadmin API -> 401", async () => {
  const r = await api("GET", "/superadmin/tenants");
  return { pass: r.status === 401, expected: "401", actual: `${r.status}` };
});

await t("E04", "Tenant access to superadmin API blocked", async () => {
  const r = await api("GET", "/superadmin/tenants", { token: saToken });
  return { pass: r.status === 401 || r.status === 403, expected: "401/403", actual: `${r.status}` };
});

await t("E05", "Tenants list returns rows + total", async () => {
  const r = await api("GET", "/superadmin/tenants", { headers: sa });
  return { pass: r.status === 200 && Array.isArray(r.json?.tenants) && typeof r.json?.total === "number", expected: "200 {tenants,total}", actual: `${r.status} total=${r.json?.total}` };
});

await t("E06", "Tenant detail returns store + stats", async () => {
  const r = await api("GET", `/superadmin/tenants/${A.store1.owner.user.storeId}`, { headers: sa });
  return { pass: r.status === 200 && !!r.json?.store, expected: "200 {store}", actual: `${r.status} owner=${r.json?.store?.owner_email ?? r.json?.store?.ownerEmail}` };
});

await t("E07", "Tenant users list", async () => {
  const r = await api("GET", `/superadmin/tenants/${A.store1.owner.user.storeId}/users`, { headers: sa });
  return { pass: r.status === 200 && Array.isArray(r.json?.users), expected: "200 {users}", actual: `${r.status} users=${r.json?.users?.length}` };
});

await t("E08", "Billing summary returns plans + tenants", async () => {
  const r = await api("GET", "/superadmin/billing", { headers: sa });
  return { pass: r.status === 200 && !!r.json?.summary, expected: "200 {summary}", actual: `${r.status} tenants=${r.json?.summary?.tenants}` };
});

await t("E09", "Settings GET returns object", async () => {
  const r = await api("GET", "/superadmin/settings", { headers: sa });
  return { pass: r.status === 200 && typeof r.json === "object", expected: "200 settings", actual: `${r.status}` };
});

await t("E10", "Settings PATCH applies whitelisted key", async () => {
  const r = await api("PATCH", "/superadmin/settings", { headers: sa, body: { updates: { maintenance_mode: false } } });
  return { pass: r.status === 200 && r.json?.ok === true, expected: "200 applied", actual: `${r.status} applied=${JSON.stringify(r.json?.applied)}` };
});

await t("E11", "Settings PATCH ignores non-whitelisted key", async () => {
  const r = await api("PATCH", "/superadmin/settings", { headers: sa, body: { updates: { dangerous_key: "x" } } });
  return { pass: r.status === 200 && !("dangerous_key" in (r.json?.applied ?? {})), expected: "ignored", actual: `${r.status} applied=${JSON.stringify(r.json?.applied)}` };
});

await t("E12", "Logs endpoint returns audit arrays", async () => {
  const r = await api("GET", "/superadmin/logs", { headers: sa });
  return { pass: r.status === 200 && Array.isArray(r.json?.superadminLogs), expected: "200 {superadminLogs,tenantLogs}", actual: `${r.status} saLogs=${r.json?.superadminLogs?.length}` };
});

await t("E13", "Impersonate returns a tenant token", async () => {
  const r = await api("POST", `/superadmin/tenants/${A.store1.owner.user.storeId}/impersonate`, { headers: sa, body: { reason: "QA impersonation test" } });
  const tok = r.json?.accessToken;
  let meCall = null;
  if (tok) meCall = await api("GET", "/auth/me", { token: tok });
  return { pass: r.status === 200 && !!tok && meCall?.status === 200, expected: "200 + usable token", actual: `imp=${r.status} meAsImpersonated=${meCall?.status} role=${meCall?.json?.user?.role}` };
});

await t("E14", "Suspend then reactivate a tenant (store2)", async () => {
  const id = A.store2.owner.user.storeId;
  const s = await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "SUSPEND", reason: "QA suspend test" } });
  const a = await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "ACTIVATE", reason: "QA reactivate" } });
  return { pass: s.status === 200 && s.json?.status === "SUSPENDED" && a.status === 200 && a.json?.status === "ACTIVE", expected: "suspend 200 then activate 200", actual: `suspend=${s.status}/${s.json?.status} activate=${a.status}/${a.json?.status}` };
});

await t("E15", "Suspended tenant still has API access (suspension not enforced)", async () => {
  const id = A.store2.owner.user.storeId;
  await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "SUSPEND", reason: "QA suspend enforcement check" } });
  const call = await api("GET", "/auth/me", { token: A.store2.owner.token });
  await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "ACTIVATE", reason: "QA cleanup" } });
  return {
    pass: call.status === 401 || call.status === 403,
    status: call.status === 200 ? "FAIL" : "PASS",
    severity: "high",
    expected: "Suspended tenant requests rejected (401/403)",
    actual: `suspended tenant GET /auth/me = ${call.status}`,
    notes: "authenticate() never checks stores.status, so a SUSPENDED tenant keeps full API access.",
  };
});

await t("E16", "Suspend unknown tenant -> 404", async () => {
  const r = await api("PATCH", `/superadmin/tenants/00000000-0000-0000-0000-000000000000/status`, { headers: sa, body: { action: "SUSPEND", reason: "nope" } });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

await t("E16b", "Double suspend -> 409", async () => {
  const id = A.store2.owner.user.storeId;
  await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "SUSPEND", reason: "QA duplicate" } });
  const again = await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "SUSPEND", reason: "QA duplicate" } });
  await api("PATCH", `/superadmin/tenants/${id}/status`, { headers: sa, body: { action: "ACTIVATE", reason: "QA cleanup" } });
  return { pass: again.status === 409, expected: "409", actual: `${again.status}` };
});

// ---- Plan CRUD ----
let planId;
const ptag = Date.now().toString().slice(-6);
const planBody = (over = {}) => ({
  name: `QA Plan ${ptag}`,
  description: "qa",
  priceMonthly: 99,
  priceYearly: 990,
  trialDays: 7,
  displayOrder: 99,
  status: "DRAFT",
  modules: [{ moduleKey: "PRODUCTS", enabled: true, limitValue: 50 }],
  ...over,
});

await t("E17", "Create plan (draft) -> 201", async () => {
  const r = await api("POST", "/superadmin/plans", { headers: sa, body: planBody() });
  planId = r.json?.plan?.id ?? r.json?.id;
  return { pass: r.status === 201 && !!planId, expected: "201", actual: `${r.status} id=${planId} ${r.status !== 201 ? JSON.stringify(r.json).slice(0, 160) : ""}` };
});

await t("E18", "Update plan -> 200", async () => {
  const r = await api("PATCH", `/superadmin/plans/${planId}`, { headers: sa, body: planBody({ priceMonthly: 199 }) });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("E19", "Duplicate plan -> 201", async () => {
  const r = await api("POST", `/superadmin/plans/${planId}/duplicate`, { headers: sa, body: {} });
  return { pass: r.status === 201, expected: "201", actual: `${r.status}` };
});

await t("E20", "Archive/delete plan -> 200", async () => {
  const r = await api("DELETE", `/superadmin/plans/${planId}`, { headers: sa });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("E21", "Assign nonexistent plan to tenant -> 404", async () => {
  const r = await api("PATCH", `/superadmin/tenants/${A.store1.owner.user.storeId}/plan`, { headers: sa, body: { planId: "00000000-0000-0000-0000-000000000000", reason: "qa reason" } });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

console.log("\nSection E complete.");

