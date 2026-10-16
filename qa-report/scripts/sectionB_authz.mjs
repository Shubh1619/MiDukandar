// Section B - Authorization, roles, tenant isolation, plan gating
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const s1 = A.store1.owner.token;
const s2 = A.store2.owner.token;
const manager = A.staff.manager.token;
const cashier = A.staff.cashier.token;
const staff = A.staff.staff.token;

const p1 = A.fixtures.products?.products?.[0]?.id;
const sale1 = A.fixtures.sales?.sales?.[0]?.id;
const cust1 = A.fixtures.customers?.customers?.[0]?.id;

// helper: does the guard block? (403 = blocked; anything else = passed authz)
const blocked = (r) => r.status === 403;
const passedAuthz = (r) => r.status !== 403;

await t("B01", "Owner can list users", async () => {
  const r = await api("GET", "/users", { token: s1 });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("B02", "Manager can list users", async () => {
  const r = await api("GET", "/users", { token: manager });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("B03", "Cashier blocked from listing users", async () => {
  const r = await api("GET", "/users", { token: cashier });
  return { pass: blocked(r), expected: "403", actual: `${r.status}` };
});

await t("B04", "Staff blocked from listing users", async () => {
  const r = await api("GET", "/users", { token: staff });
  return { pass: blocked(r), expected: "403", actual: `${r.status}` };
});

await t("B05", "Manager blocked from inviting users (owner-only)", async () => {
  const r = await api("POST", "/users/invite", { token: manager, body: { name: "X Y", email: "mgr.invite@demo.local", role: "STAFF" } });
  return { pass: blocked(r), expected: "403", actual: `${r.status}` };
});

await t("B06", "Cashier blocked from editing role permissions", async () => {
  const r = await api("PATCH", "/roles/STAFF", { token: cashier, body: { permissions: {} } });
  return { pass: blocked(r), expected: "403", actual: `${r.status}` };
});

await t("B07", "Manager can read role matrix", async () => {
  const r = await api("GET", "/roles", { token: manager });
  return { pass: r.status === 200 && Array.isArray(r.json?.flags), expected: "200 + flags", actual: `${r.status}` };
});

await t("B08", "Staff blocked from creating products", async () => {
  const r = await api("POST", "/products", { token: staff, body: {} });
  return { pass: blocked(r), expected: "403 (authorized-with-bad-body would be 400)", actual: `${r.status}` };
});

await t("B09", "Cashier product-create matches permission matrix (can_manage_products=false)", async () => {
  const r = await api("POST", "/products", { token: cashier, body: { name: `QA-CASHIER-PROD-${Date.now()}`, sellingPrice: 10, purchasePrice: 8 } });
  return {
    pass: blocked(r),
    expected: "403 per DEFAULT_PERMISSIONS.CASHIER.can_manage_products=false",
    actual: `${r.status}`,
    severity: "medium",
    notes: "POST /api/products preHandler allows CASHIER; role gate contradicts the advertised permission matrix (which is itself unenforced).",
  };
});

await t("B10", "Manager authorized to create products (bad body -> 400, not 403)", async () => {
  const r = await api("POST", "/products", { token: manager, body: {} });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("B11", "Cashier can reach create-sale handler (bad body -> 400, not 403)", async () => {
  const r = await api("POST", "/sales", { token: cashier, body: {} });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("B12", "Staff blocked from creating sales", async () => {
  const r = await api("POST", "/sales", { token: staff, body: {} });
  return { pass: blocked(r), expected: "403", actual: `${r.status}` };
});

// Cross-tenant isolation
await t("B13", "Store2 sees only its own products (store isolation)", async () => {
  const r = await api("GET", "/products", { token: s2 });
  const total = r.json?.total ?? r.json?.products?.length;
  return { pass: r.status === 200 && Number(total) === 0, expected: "200, total=0", actual: `${r.status} total=${total}` };
});

await t("B14", "Store2 cannot read Store1 product by id (404, no leak)", async () => {
  const r = await api("GET", `/products/${p1}`, { token: s2 });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

await t("B15", "Store2 cannot read Store1 sale by id (404)", async () => {
  const r = await api("GET", `/sales/${sale1}`, { token: s2 });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

await t("B16", "Store2 cannot read Store1 customer by id (404)", async () => {
  const r = await api("GET", `/customers/${cust1}`, { token: s2 });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

await t("B17", "Store2 cannot mutate Store1 product (404)", async () => {
  const r = await api("PUT", `/products/${p1}`, { token: s2, body: { name: "hacked" } });
  return { pass: r.status === 404, expected: "404", actual: `${r.status}` };
});

// Plan module gating on Free plan (store2)
const freeCases = [
  ["B18", "Free plan: SUPPLIERS module blocked", "/suppliers"],
  ["B19", "Free plan: PURCHASES module blocked", "/purchases"],
  ["B20", "Free plan: EXPENSES module blocked", "/expenses"],
  ["B21", "Free plan: USERS_ROLES module blocked", "/users"],
  ["B22", "Free plan: GST_REPORTS (reports/pnl) blocked", "/reports/pnl"],
  ["B23", "Free plan: GST_REPORTS (reports/sales) blocked", "/reports/sales"],
];
for (const [id, title, endpoint] of freeCases) {
  await t(id, title, async () => {
    const r = await api("GET", endpoint, { token: s2 });
    return { pass: r.status === 403, expected: "403 (module disabled)", actual: `${r.status}` };
  });
}

await t("B23b", "Free plan: DASHBOARD still allowed", async () => {
  const r = await api("GET", "/reports/dashboard", { token: s2 });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

// Pro plan access on store1
await t("B24", "Pro plan: suppliers accessible", async () => {
  const r = await api("GET", "/suppliers", { token: s1 });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("B23b-check", "Pro plan: reports/pnl accessible", async () => {
  const r = await api("GET", "/reports/pnl", { token: s1 });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

// Permission flags are declared but do they get enforced?
await t("B24-flags", "Role permission flags are actually enforced", async () => {
  // Give CASHIER every permission flag, then check an owner-only route stays blocked.
  const before = await api("GET", "/roles", { token: s1 });
  const cashierPerms = before.json?.roles?.find((x) => x.role === "CASHIER")?.permissions ?? {};
  const allTrue = Object.fromEntries(Object.keys(cashierPerms).map((k) => [k, true]));
  await api("PATCH", "/roles/CASHIER", { token: s1, body: { permissions: allTrue } });
  const invite = await api("POST", "/users/invite", { token: cashier, body: { name: "Y Z", email: "cashier.invite@demo.local", role: "STAFF" } });
  await api("PATCH", "/roles/CASHIER", { token: s1, body: { permissions: cashierPerms } }); // restore
  // If flags were enforced, can_manage_users=true would still not allow invite (role OWNER gate), so this only proves role gate.
  const users = await api("GET", "/users", { token: cashier });
  return {
    pass: users.status === 200,
    status: users.status === 200 ? "WARN" : "PASS",
    severity: "medium",
    expected: "If flags are enforced, granting can_manage_users to CASHIER makes /users succeed; checkPermission() is never called anywhere, so flags are advisory-only.",
    actual: `after granting all flags: GET /users as cashier = ${users.status}, POST /users/invite = ${invite.status}`,
    notes: "checkPermission() is defined in middlewares/auth.ts but is not referenced by any route — role flags from /api/roles are not enforced server-side.",
  };
});

console.log("\nSection B complete.");

