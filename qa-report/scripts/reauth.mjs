// Re-auth: refresh short-lived access tokens for existing QA accounts without
// recreating fixtures. One OTP request per email. Run from repo root:
//   node qa-report/scripts/reauth.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, OTP_MASTER } from "./lib.mjs";

const api = (m, p, o) => http(m, `${API}/api${p}`, o);
const file = path.join(DATA_DIR, "accounts.json");
const A = JSON.parse(await readFile(file, "utf8"));

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

const targets = [
  ["store1", "owner", "owner@midukandar.demo"],
  ["store2", "owner", "qa.owner2@demo.local"],
  ["staff", "manager", "qa.manager@demo.local"],
  ["staff", "cashier", "qa.cashier@demo.local"],
  ["staff", "staff", "qa.staff@demo.local"],
];
for (const [g, k, email] of targets) {
  const r = await login(email);
  if (r.token) A[g][k] = { ...A[g][k], ...r };
  console.log(`${g}.${k}`, r.status, r.user?.role, r.token ? "token ok" : "NO TOKEN");
}

const t = A.store1.owner.token;
const safe = async (p) => (await api("GET", p, { token: t })).json;
A.fixtures = {
  products: await safe("/products"),
  customers: await safe("/customers"),
  sales: await safe("/sales"),
  suppliers: await safe("/suppliers"),
};
console.log("fixtures refreshed:", A.fixtures.products?.products?.length, "products");

const saLogin = await api("POST", "/superadmin/auth/login", { body: { email: "superadmin@midukandar.com", password: "admin@123" } });
const saCookie = saLogin.setCookie.find((c) => /mz_sa/.test(c)) ?? null;
if (saCookie) A.superadmin = { ...A.superadmin, status: saLogin.status, cookie: saCookie, cookieValue: saCookie.split(";")[0] };
console.log("superadmin", saLogin.status, saCookie ? "cookie ok" : "NO COOKIE");

await writeFile(file, JSON.stringify(A, null, 2));
console.log("wrote", file);
