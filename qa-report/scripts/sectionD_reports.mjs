// Section D - Reports & exports
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const owner = A.store1.owner.token;

await t("D01", "Dashboard returns stats", async () => {
  const r = await api("GET", "/reports/dashboard", { token: owner });
  return { pass: r.status === 200 && !!r.json?.stats, expected: "200 {stats}", actual: `${r.status} keys=${Object.keys(r.json?.stats ?? {}).join(",").slice(0, 80)}` };
});

await t("D02", "Sales report returns rows + trend", async () => {
  const r = await api("GET", "/reports/sales", { token: owner });
  return { pass: r.status === 200 && Array.isArray(r.json?.rows ?? r.json?.trend), expected: "200", actual: `${r.status}` };
});

await t("D03", "Purchases report returns 200", async () => {
  const r = await api("GET", "/reports/purchases", { token: owner });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("D04", "Stock current report returns stock + totalValue", async () => {
  const r = await api("GET", "/reports/stock/current", { token: owner });
  return { pass: r.status === 200 && Array.isArray(r.json?.stock) && typeof r.json?.totalValue === "number", expected: "200 {stock,totalValue}", actual: `${r.status} items=${r.json?.stock?.length} value=${r.json?.totalValue}` };
});

await t("D05", "Stock movements report returns rows", async () => {
  const r = await api("GET", "/reports/stock/movements", { token: owner });
  return { pass: r.status === 200 && Array.isArray(r.json?.rows), expected: "200 {rows}", actual: `${r.status}` };
});

await t("D06", "P&L report returns required fields", async () => {
  const r = await api("GET", "/reports/pnl", { token: owner });
  const j = r.json ?? {};
  const need = ["revenue", "cogs", "grossProfit", "expenses", "netProfit"];
  const missing = need.filter((k) => typeof j[k] !== "number");
  return { pass: r.status === 200 && missing.length === 0, expected: "200 with numeric revenue/cogs/grossProfit/expenses/netProfit", actual: `${r.status} missing=${missing.join(",") || "none"}`, evidence: JSON.stringify(j).slice(0, 240) };
});

await t("D07", "P&L math: netProfit == grossProfit - expenses", async () => {
  const r = await api("GET", "/reports/pnl", { token: owner });
  const j = r.json ?? {};
  const diff = Math.abs((Number(j.grossProfit) - Number(j.expenses)) - Number(j.netProfit));
  return { pass: diff < 0.01, expected: "netProfit = grossProfit - expenses", actual: `gp=${j.grossProfit} exp=${j.expenses} np=${j.netProfit} diff=${diff}` };
});

await t("D08", "P&L accepts explicit date range", async () => {
  const r = await api("GET", "/reports/pnl?from=2020-01-01&to=2030-01-01", { token: owner });
  return { pass: r.status === 200 && !!r.json?.from && !!r.json?.to, expected: "200 with echoed range", actual: `${r.status} ${r.json?.from}..${r.json?.to}` };
});

await t("D09", "GST report returns rate breakup", async () => {
  const r = await api("GET", "/reports/gst", { token: owner });
  const j = r.json ?? {};
  const hasBreakup = Array.isArray(j.rateBreakup) || Array.isArray(j.breakup) || !!j.summary;
  return { pass: r.status === 200 && hasBreakup, expected: "200 with rate breakup", actual: `${r.status} keys=${Object.keys(j).join(",").slice(0, 100)}`, evidence: JSON.stringify(j).slice(0, 240) };
});

await t("D10", "GST invalid date -> 400", async () => {
  const r = await api("GET", "/reports/gst?from=not-a-date", { token: owner });
  return { pass: r.status === 400, expected: "400", actual: `${r.status} ${(r.text ?? "").slice(0, 40)}`, severity: "medium", notes: "Invalid date reaches Postgres and throws 500 (code 22007) and the PG code is echoed to the client." };
});

await t("D11", "Product export template.csv returns CSV", async () => {
  const r = await http("GET", `${API}/api/products/template.csv`, { token: owner });
  return { pass: r.status === 200 && /csv|text\/plain/.test(r.headers["content-type"] ?? ""), expected: "200 csv", actual: `${r.status} ct=${r.headers["content-type"]}` };
});

await t("D12", "Product export template.xlsx returns xlsx", async () => {
  const r = await http("GET", `${API}/api/products/template.xlsx`, { token: owner });
  return { pass: r.status === 200 && /spreadsheet|xlsx|octet-stream/.test(r.headers["content-type"] ?? ""), expected: "200 xlsx", actual: `${r.status} ct=${r.headers["content-type"]}` };
});

await t("D13", "Product export xlsx returns file", async () => {
  const r = await http("GET", `${API}/api/products/export/xlsx`, { token: owner });
  return { pass: r.status === 200, expected: "200", actual: `${r.status} ct=${r.headers["content-type"]}` };
});

await t("D14", "Product export pdf returns PDF", async () => {
  const r = await http("GET", `${API}/api/products/export/pdf`, { token: owner });
  return { pass: r.status === 200, expected: "200", actual: `${r.status} ct=${r.headers["content-type"]}` };
});

await t("D15", "Plans list is public/available", async () => {
  const r = await api("GET", "/plans");
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

console.log("\nSection D complete.");
