// Minimal QA harness + HTTP client for the MiDukandar QA pass.
// Read-only against the app: it only calls public API endpoints and never
// mutates server source. Run from the repo root:  node qa-report/scripts/xxx.mjs
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const API = process.env.QA_API ?? "http://localhost:4000";
export const WEB = process.env.QA_WEB ?? "http://localhost:3000";
export const OTP_MASTER = process.env.QA_OTP ?? "000000";

const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "qa-report", "_data");
const RESULTS = path.join(DATA_DIR, "results.jsonl");

await mkdir(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------
export async function http(method, url, { token, body, headers = {}, redirect = "manual" } = {}) {
  const h = { ...headers };
  let payload;
  if (body !== undefined) {
    if (typeof body === "string" || body instanceof Buffer) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      h["content-type"] ??= "application/json";
    }
  }
  if (token) h.authorization = `Bearer ${token}`;
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, { method, headers: h, body: payload, redirect });
  } catch (err) {
    return { ok: false, status: 0, error: String(err), ms: Date.now() - started, headers: {}, setCookie: [] };
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const headersObj = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  return {
    ok: res.ok,
    status: res.status,
    json,
    text,
    headers: headersObj,
    setCookie,
    ms: Date.now() - started,
  };
}

export const api = (method, urlPath, opts) => http(method, `${API}${urlPath}`, opts);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
export async function login(email, purpose = "LOGIN") {
  const req = await http("POST", `${API}/api/auth/otp/request`, { body: { email, purpose } });
  const res = await http("POST", `${API}/api/auth/otp/verify`, {
    body: { email, otp: OTP_MASTER, purpose },
  });
  return {
    requestStatus: req.status,
    requestJson: req.json,
    status: res.status,
    json: res.json,
    text: res.text,
    accessToken: res.json?.accessToken ?? null,
    user: res.json?.user ?? null,
    refreshCookie: res.setCookie.find((c) => /refresh/i.test(c)) ?? null,
    allCookies: res.setCookie,
  };
}

export async function superAdminLogin(email, password, url = `${API}/api/auth/superadmin`) {
  return http("POST", `${API}/api/superadmin/auth/login`, { body: { email, password } });
}

// ---------------------------------------------------------------------------
// Test harness. Records every case to _data/results.jsonl (one JSON per line).
// ---------------------------------------------------------------------------
const buffer = [];

export function record(r) {
  const row = {
    ts: new Date().toISOString(),
    section: r.section ?? "",
    id: r.id,
    title: r.title,
    status: r.status, // PASS | FAIL | WARN | SKIP | MANUAL
    severity: r.severity ?? "",
    expected: r.expected ?? "",
    actual: r.actual ?? "",
    evidence: r.evidence ?? "",
    notes: r.notes ?? "",
  };
  buffer.push(row);
  appendFile(RESULTS, JSON.stringify(row) + "\n").catch(() => {});
  const icon = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", SKIP: "SKIP", MANUAL: "MAN " }[row.status] ?? "?";
  const extra = row.status === "FAIL" || row.status === "WARN" ? `  (actual: ${row.actual})` : "";
  console.log(`[${icon}] ${row.id}  ${row.title}${extra}${row.notes ? "  :: " + row.notes : ""}`);
  return row;
}

// t("A1", "title", async () => ({ pass, expected, actual, severity, evidence, notes }))
export async function t(id, title, fn) {
  try {
    const out = (await fn()) ?? {};
    const pass = out.pass === true;
    return record({
      id, title,
      status: out.status ?? (pass ? "PASS" : "FAIL"),
      severity: pass ? "" : (out.severity ?? "medium"),
      expected: out.expected,
      actual: out.actual,
      evidence: out.evidence,
      notes: out.notes,
    });
  } catch (err) {
    return record({
      id, title, status: "FAIL", severity: "high",
      expected: "no exception", actual: String(err?.stack ?? err),
    });
  }
}

export function manual(id, title, notes) {
  return record({ id, title, status: "MANUAL", notes });
}

export async function flush(sectionFile) {
  await appendFile(RESULTS, buffer.map((r) => JSON.stringify(r)).join("\n") + (buffer.length ? "\n" : ""));
  if (sectionFile) {
    await writeFile(path.join(DATA_DIR, sectionFile), JSON.stringify(buffer, null, 2));
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
