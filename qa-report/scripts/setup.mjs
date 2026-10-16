// QA setup: prepare test accounts + fixtures on the LOCAL stack.
// Run from repo root:  node qa-report/scripts/setup.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, OTP_MASTER } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const out = {};

async function login(email) {
  await api("POST", "/auth/otp/request", { body: { email, purpose: "LOGIN" } });
  const res = await api("POST", "/auth/otp/verify", { body: { email, otp: OTP_MASTER, purpose: "LOGIN" } });
  return {
    email,
    status: res.status,
    token: res.json?.accessToken ?? null,
    user: res.json?.user ?? null,
    refreshCookie: res.setCookie.find((c) => /mz_refresh/.test(c)) ?? null,
  };
}

async function register(email, extra = {}) {
  const res = await api("POST", "/auth/register", {
    body: {
      email,
      ownerName: extra.ownerName ?? "QA Owner",
      name: extra.name ?? "QA Store",
      type: extra.type ?? "Kirana",
      ...extra,
    },
  });
  return res;
}

// --- Store 1 (seeded) owner -----------------------------------------------
out.store1 = { owner: await login("owner@midukandar.demo") };
console.log("store1 owner:", out.store1.owner.status, out.store1.owner.user?.storeId);

// --- Superadmin -----------------------------------------------------------
const saLogin = await api("POST", "/superadmin/auth/login", {
  body: { email: "superadmin@midukandar.com", password: "admin@123" },
});
const saCookie = saLogin.setCookie.find((c) => /mz_sa/.test(c)) ?? null;
out.superadmin = {
  email: "superadmin@midukandar.com",
  status: saLogin.status,
  cookie: saCookie,
  cookieValue: saCookie ? saCookie.split(";")[0] : null,
};
console.log("superadmin:", saLogin.status, saCookie ? "(cookie ok)" : "(NO COOKIE)");

// --- Store 2 (fresh registration, stays on Free) --------------------------
const email2 = "qa.owner2@demo.local";
let reg2 = await register(email2, { ownerName: "QA Owner Two", name: "QA Store Two" });
if (reg2.status === 409) console.log("store2 already exists, logging in");
out.store2 = { owner: await login(email2) };
console.log("store2 owner:", out.store2.owner.status, out.store2.owner.user?.storeId);

// --- Upgrade Store 1 to Pro (so paid modules are testable) -----------------
const plansRes = await api("GET", "/superadmin/plans", { headers: { cookie: out.superadmin.cookieValue } });
const plans = plansRes.json?.plans ?? plansRes.json ?? [];
const pro = Array.isArray(plans) ? plans.find((p) => String(p.name).toLowerCase() === "pro") : null;
out.plans = Array.isArray(plans) ? plans.map((p) => ({ id: p.id, name: p.name })) : plansRes.json;
if (pro && out.store1.owner.user?.storeId) {
  const up = await api("PATCH", `/superadmin/tenants/${out.store1.owner.user.storeId}/plan`, {
    headers: { cookie: out.superadmin.cookieValue },
    body: { planId: pro.id, reason: "QA full-feature testing" },
  });
  console.log("upgrade store1 ->", pro.name, up.status);
  // refresh token so /me reflects the new plan
  out.store1.owner = await login("owner@midukandar.demo");
}

// --- Staff on Store1: manager / cashier / staff ---------------------------
async function ensureStaff(role, email, name) {
  const invite = await api("POST", "/users/invite", {
    token: out.store1.owner.token,
    body: { name, email, role },
  });
  let token = invite.json?.inviteLink?.split("token=")[1];
  if (invite.status === 201 && token) {
    await api("POST", "/users/invite/accept", { body: { token, password: "password123" } });
  } else {
    console.log(`invite ${role}:`, invite.status, invite.text?.slice(0, 120));
  }
  return login(email);
}
out.staff = {};
out.staff.manager = await ensureStaff("MANAGER", "qa.manager@demo.local", "QA Manager");
out.staff.cashier = await ensureStaff("CASHIER", "qa.cashier@demo.local", "QA Cashier");
out.staff.staff = await ensureStaff("STAFF", "qa.staff@demo.local", "QA Staff");
for (const [k, v] of Object.entries(out.staff)) console.log(`staff ${k}:`, v.status, v.user?.role);

// --- Capture seed fixtures on Store1 --------------------------------------
const t = out.store1.owner.token;
const safe = async (p) => (await api("GET", p, { token: t })).json;
out.fixtures = {
  products: await safe("/products"),
  customers: await safe("/customers"),
  sales: await safe("/sales"),
  suppliers: await safe("/suppliers"),
};

const file = path.join(DATA_DIR, "accounts.json");
await writeFile(file, JSON.stringify(out, null, 2));
console.log("wrote", file);
