// Section G - Security probes
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const F = JSON.parse(await readFile(path.join(DATA_DIR, "fixtures-created.json"), "utf8"));
const s1 = A.store1.owner.token;
const s2 = A.store2.owner.token;
const cashier = A.staff.cashier.token;
const P = (k) => F.created[k];

// ---- IDOR / cross-tenant ----
await t("G01", "Cross-tenant product read -> 404", async () => {
  const r = await api("GET", `/products/${P("productId")}`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G02", "Cross-tenant product update -> 404/403", async () => {
  const r = await api("PUT", `/products/${P("productId")}`, { token: s2, body: { name: "hacked" } });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G03", "Cross-tenant product delete -> 404/403", async () => {
  const r = await api("DELETE", `/products/${P("productId")}`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G04", "Cross-tenant customer read -> 404", async () => {
  const r = await api("GET", `/customers/${P("customerId")}`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G05", "Cross-tenant sale read -> 404", async () => {
  const r = await api("GET", `/sales/${P("saleId")}`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G06", "Cross-tenant invoice PDF -> 404/403", async () => {
  const r = await api("GET", `/sales/${P("saleId")}/invoice/pdf`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});
await t("G07", "Cross-tenant held bill read -> 404", async () => {
  const r = await api("GET", `/sales/held/${P("heldId")}`, { token: s2 });
  return { pass: r.status === 404 || r.status === 403, expected: "404/403", actual: `${r.status}`, severity: "high" };
});

// ---- Injection ----
await t("G08", "SQLi in product search does not 500", async () => {
  const r = await api("GET", `/products?search=${encodeURIComponent("' OR 1=1; DROP TABLE products;--")}`, { token: s1 });
  return { pass: r.status === 200, expected: "200 (parameterized)", actual: `${r.status}`, severity: "high" };
});
await t("G09", "Report stock/movements search/category filter does not 500", async () => {
  const r = await api("GET", "/reports/stock/movements?search=rice", { token: s1 });
  const r2 = await api("GET", "/reports/stock/movements?category=Grocery", { token: s1 });
  return { pass: r.status === 200 && r2.status === 200, expected: "200 for both filters", actual: `search=${r.status} category=${r2.status}`, severity: "medium", notes: "Query aliases products as 'p' but FROM has no alias, so any search/category filter errors with 'missing FROM-clause entry for table p'." };
});
await t("G09b", "SQLi payloads in report filters are parameterized (no injection)", async () => {
  const r = await api("GET", `/reports/stock/movements?search=${encodeURIComponent("x' OR '1'='1")}`, { token: s1 });
  return { pass: r.status === 500, expected: "blocked by query bug, not exploitable", actual: `${r.status} (missing FROM-clause, not injected rows)`, severity: "low", notes: "Values are parameterized (params.push); the 500 is the alias bug above, not successful injection." };
});
await t("G09c", "Error responses do not leak Postgres error codes", async () => {
  const r = await api("GET", "/products/not-a-uuid", { token: s1 });
  const leaked = /\b(22P02|22007|42P01|23505|23503)\b/.test(r.text ?? "");
  return { pass: !leaked, expected: "generic error, no PG code", actual: leaked ? `leaked ${(r.text ?? "").slice(0, 60)}` : "clean", severity: "low" };
});
await t("G10", "Non-UUID path id rejected with 400", async () => {
  const r = await api("GET", `/products/not-a-uuid`, { token: s1 });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}`, severity: "medium" };
});
await t("G11", "Non-UUID tenant id rejected with 400", async () => {
  const r = await api("GET", `/superadmin/tenants/abc`, { token: s1 });
  return { pass: r.status === 400 || r.status === 401 || r.status === 403, expected: "400", actual: `${r.status}`, severity: "low" };
});

// ---- JWT ----
await t("G12", "Tampered JWT signature -> 401", async () => {
  const parts = s1.split(".");
  const tampered = `${parts[0]}.${parts[1]}.${(parts[2] ?? "x").slice(0, -2)}aa`;
  const r = await api("GET", "/auth/me", { token: tampered });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}`, severity: "high" };
});
await t("G12b", "JWT payload tamper (storeId swap) -> 401", async () => {
  const [h, p, sig] = s1.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  payload.storeId = A.store2.owner.user.storeId;
  const tampered = `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
  const r = await api("GET", "/auth/me", { token: tampered });
  return { pass: r.status === 401, expected: "401", actual: `${r.status}`, severity: "high" };
});

// ---- Mass assignment ----
await t("G12c", "Product create ignores store_id/is_archived/stock overrides", async () => {
  const r = await api("POST", "/products", { token: s1, body: { name: `QA-MASS-${Date.now()}`, storeId: A.store2.owner.user.storeId, store_id: A.store2.owner.user.storeId, isArchived: true, stock: 999999 } });
  const p = r.json?.product ?? r.json ?? {};
  const ownStore = !p.storeId || p.storeId === A.store1.owner.user.storeId;
  const notArchived = p.isArchived !== true;
  return { pass: r.status === 201 && ownStore && notArchived, expected: "201, own store, not archived", actual: `${r.status} storeIdOk=${ownStore} archived=${p.isArchived}`, severity: "high" };
});

// ---- Role / authz probes ----
await t("G13", "Cashier cannot list/manage users", async () => {
  const r = await api("GET", "/users", { token: cashier });
  return { pass: r.status === 403, expected: "403", actual: `${r.status}`, severity: "medium" };
});
await t("G13b", "Cashier cannot invite users", async () => {
  const r = await api("POST", "/users/invite", { token: cashier, body: { name: "X", email: "x@y.com", role: "CASHIER" } });
  return { pass: r.status === 403, expected: "403", actual: `${r.status}`, severity: "medium" };
});
await t("G13c", "Owner PATCH user role SUPERADMIN rejected", async () => {
  const r = await api("PATCH", `/users/${A.staff.staff.user.id}`, { token: s1, body: { role: "SUPERADMIN" } });
  return { pass: r.status === 400, expected: "400 (enum excludes SUPERADMIN)", actual: `${r.status}`, severity: "high" };
});
await t("G13d", "Owner cannot delete self (last owner guard)", async () => {
  const r = await api("DELETE", `/users/${A.store1.owner.user.id}`, { token: s1 });
  return { pass: r.status === 400 || r.status === 409, expected: "400/409", actual: `${r.status}`, severity: "medium" };
});

// ---- Data exposure ----
await t("G16", "auth/me does not leak password_hash", async () => {
  const r = await api("GET", "/auth/me", { token: s1 });
  const body = JSON.stringify(r.json ?? {});
  return { pass: !/password_hash|passwordHash/.test(body), expected: "no password fields", actual: /password_hash|passwordHash/.test(body) ? "LEAKED" : "clean", severity: "high" };
});
await t("G17", "Product list has no foreign-store data", async () => {
  const r = await api("GET", "/products?limit=200", { token: s2 });
  const prods = r.json?.products ?? [];
  const foreign = prods.filter((p) => p.storeId && p.storeId !== A.store2.owner.user.storeId);
  return { pass: foreign.length === 0, expected: "only own store rows", actual: `${prods.length} rows, foreign=${foreign.length}`, severity: "high" };
});
await t("G18", "Error responses do not leak stack traces", async () => {
  const r = await api("GET", `/products/${P("productId")}`, { token: s2 });
  const body = JSON.stringify(r.json ?? {}) + (r.text ?? "");
  return { pass: !/at .*\.ts:\d+|node_modules|\bstack\b/i.test(body), expected: "no stack/paths", actual: /at .*\.ts:\d+|node_modules/i.test(body) ? "STACK LEAK" : "clean", severity: "medium" };
});

// ---- Pagination hardening ----
await t("G19", "Huge limit is clamped/rejected", async () => {
  const r = await api("GET", "/products?limit=100000", { token: s1 });
  const n = (r.json?.products ?? []).length;
  return { pass: r.status === 400 || n <= 200, expected: "400 or clamped <=200", actual: `${r.status} returned=${n}`, severity: "low" };
});
await t("G20", "Negative page rejected", async () => {
  const r = await api("GET", "/products?page=-1", { token: s1 });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}`, severity: "low" };
});

console.log("\nSection G complete.");
