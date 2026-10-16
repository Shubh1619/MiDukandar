import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// ---------- mobile endpoints ----------
const svcPath = path.join(root, "app/lib/services/api_service.dart");
const svc = fs.readFileSync(svcPath, "utf8");
const lines = svc.split("\n");

const methodStarts = [];
lines.forEach((l, i) => {
  if (!/Future</.test(l)) return;
  const m = l.match(/\b([A-Za-z_]\w*)\s*\(/);
  if (!m) return;
  if (/^(if|while|for|switch|catch|return|else|do)$/.test(m[1])) return;
  methodStarts.push({ name: m[1], line: i + 1 });
});

const mobileEndpoints = [];
for (let i = 0; i < methodStarts.length; i++) {
  const startLine = methodStarts[i].line;
  const endLine = i + 1 < methodStarts.length ? methodStarts[i + 1].line : lines.length + 1;
  const body = lines.slice(startLine - 1, endLine - 1).join("\n");

  const pathRe = /['"`](\/api\/[^'"`]*)['"`]/g;
  let pm;
  while ((pm = pathRe.exec(body))) {
    const literal = pm[0].slice(1, -1);
    const after = body.slice(pm.index + pm[0].length);
    let win = after.slice(0, 400);
    const cut = win.search(/Future<|['"`]\/api\//);
    if (cut > -1) win = win.slice(0, cut);
    const verb =
      win.match(/method:\s*'([A-Z]+)'/)?.[1] ??
      win.match(/\.(post|put|patch|delete|get)\s*\(/)?.[1]?.toUpperCase() ??
      "GET";
    mobileEndpoints.push({
      dartMethod: methodStarts[i].name,
      line: startLine,
      method: verb,
      path: literal.replace(/\$\{[^}]*\}/g, ":x").replace(/\$\w+/g, ":x"),
      raw: literal,
    });
  }
}

// Only count endpoint usages whose dart method is actually invoked from a screen
// (mobile-calls.csv = screen-level call sites, produced by scan-mobile.mjs).
// api_service.dart method definitions alone are NOT integration.
const calledMethods = new Set(
  fs
    .readFileSync(path.join(root, "audit/mobile-calls.csv"), "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split(",")[2]),
);
const isLiveDef = (e) => calledMethods.has(e.dartMethod) || e.dartMethod.startsWith("_");
const deadMobileEndpoints = mobileEndpoints.filter((e) => !isLiveDef(e));
const liveMobileEndpoints = mobileEndpoints.filter((e) => isLiveDef(e));

const out = ["dart_method,line,method,path,live"];
for (const e of mobileEndpoints)
  out.push(`${e.dartMethod},${e.line},${e.method},"${e.raw}",${isLiveDef(e) ? "yes" : "no"}`);
fs.writeFileSync(path.join(root, "audit/mobile-endpoints.csv"), out.join("\n") + "\n");
console.log("mobile endpoint usages:", mobileEndpoints.length, "| live:", liveMobileEndpoints.length, "| dead defs:", deadMobileEndpoints.length);

// ---------- normalize ----------
function normPath(p) {
  let s = p.replace(/\?.*$/, "");
  s = s.replace(/\/\$\{[^}]*\}/g, "/:x");
  s = s.replace(/\$\{[^}]*\}/g, "");
  s = s.replace(/\/\$\w+/g, "/:x");
  s = s.replace(/\$\w+/g, "");
  s = s.replace(/:([A-Za-z_]\w*)/g, ":x");
  return s.replace(/\/$/, "");
}
function segs(p) {
  return normPath(p).split("/").filter(Boolean);
}
function wildcardMatch(caller, backend) {
  const a = segs(caller);
  const b = segs(backend);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const wa = a[i] === ":x" || a[i].startsWith(":");
    const wb = b[i] === ":x" || b[i].startsWith(":");
    if (!wa && !wb && a[i] !== b[i]) return false;
  }
  return true;
}
function normMethod(m) {
  if (!m) return "";
  m = String(m)
    .replace(/\(.*\)/g, "")
    .replace("?", "")
    .trim();
  return m;
}

// ---------- backend ----------
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}
const parseCsv = (p) =>
  fs
    .readFileSync(path.join(root, p), "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(splitCsvLine);

const be = parseCsv("audit/endpoint-map.csv").map((c) => ({
  file: c[0],
  registered: c[1],
  export: c[2],
  method: c[3],
  path: c[4],
  raw: c[5],
  auth: c[6],
  validation: c[7],
  module: c[8],
}));
const web = parseCsv("audit/web-calls.csv").map((c) => ({
  file: c[0],
  line: c[1],
  helper: c[2],
  method: c[3],
  path: c[4],
}));

const key = (m, p) => `${normMethod(m)} ${normPath(p)}`;
const beByKey = new Map();
for (const r of be) {
  const k = key(r.method, r.path);
  if (!beByKey.has(k)) beByKey.set(k, []);
  beByKey.get(k).push(r);
}
const bePaths = new Set(be.map((r) => normPath(r.path)));
const beByPath = new Map();
for (const r of be) {
  const p = normPath(r.path);
  if (!beByPath.has(p)) beByPath.set(p, new Set());
  beByPath.get(p).add(r.method);
}

function match(callerMethod, callerPath) {
  const m = normMethod(callerMethod);
  const exact = beByKey.get(`${m} ${normPath(callerPath)}`);
  if (exact) return { kind: "exact", rows: exact };
  const rows = be.filter((r) => normMethod(r.method) === m && wildcardMatch(callerPath, r.path));
  if (rows.length) return { kind: "wildcard", rows };
  const pathAny = be.filter((r) => normPath(r.path) === normPath(callerPath));
  if (pathAny.length) return { kind: "method-mismatch", rows: pathAny };
  const wildAny = be.filter((r) => wildcardMatch(callerPath, r.path));
  if (wildAny.length) return { kind: "method-mismatch", rows: wildAny };
  return { kind: "none", rows: [] };
}

const R = [];
const H = (t) => R.push(`## ${t}`, "");
const L = (t) => R.push(t);

const unmatchedWeb = web.filter((w) => match(w.method, w.path).kind === "none");
H("Web calls with NO matching backend endpoint (method + path)");
if (!unmatchedWeb.length) L("- (none)");
for (const w of unmatchedWeb) L(`- \`${w.method} ${w.path}\` — ${w.file}:${w.line} — NO BACKEND ROUTE (UI without endpoint)`);
L("");
H("Web calls that only wildcard-match (dynamic segment) — verify by hand");
for (const w of web) {
  const r = match(w.method, w.path);
  if (r.kind === "wildcard") L(`- \`${w.method} ${w.path}\` — ${w.file}:${w.line} → backend \`${r.rows.map((x) => x.method + " " + x.path).join("`, `")}\``);
}
L("");
H("Web calls hitting a path that exists with a different method");
for (const w of web) {
  const r = match(w.method, w.path);
  if (r.kind === "method-mismatch") L(`- \`${w.method} ${w.path}\` — ${w.file}:${w.line} → backend has ${[...new Set(r.rows.map((x) => x.method))].join("/")} on that path`);
}
L("");

const unmatchedMob = liveMobileEndpoints.filter((m) => match(m.method, m.path).kind === "none");
H("Mobile calls with NO matching backend endpoint (method + path)");
if (!unmatchedMob.length) L("- (none)");
for (const m of unmatchedMob) L(`- \`${m.method} ${m.raw}\` — \`${m.dartMethod}()\` ${m.line} — NO BACKEND ROUTE`);
L("");

H("Mobile API methods DEFINED but never called from a screen (dead surface)");
if (!deadMobileEndpoints.length) L("- (none)");
for (const m of deadMobileEndpoints) L(`- \`${m.dartMethod}()\` → ${m.method} ${m.raw} (api_service.dart:${m.line})`);
L("");

const isUsedByWeb = (r) => web.some((w) => match(w.method, w.path).rows.includes(r));
const isUsedByMob = (r) => liveMobileEndpoints.some((m) => match(m.method, m.path).rows.includes(r));

const handlerKey = (r) => `${r.file}|${r.export}|${r.method}|${r.raw}`;
const handlerUsedWeb = new Set();
const handlerUsedMob = new Set();
for (const r of be) {
  if (isUsedByWeb(r)) handlerUsedWeb.add(handlerKey(r));
  if (isUsedByMob(r)) handlerUsedMob.add(handlerKey(r));
}
const handlerIntegrated = new Set([...handlerUsedWeb, ...handlerUsedMob]);

H("Backend HANDLERS not reached by web nor mobile (dedup of dual-mounted URLs)");
const seenHandlers = new Set();
const orphanHandlers = be.filter((r) => {
  if (handlerIntegrated.has(handlerKey(r))) return false;
  if (seenHandlers.has(handlerKey(r))) return false;
  seenHandlers.add(handlerKey(r));
  return true;
});
for (const r of orphanHandlers) {
  const urls = be.filter((x) => handlerKey(x) === handlerKey(r)).map((x) => x.path);
  L(`- \`${r.method} ${urls.join(" / ")}\` (${r.file}, ${r.export}, auth=${r.auth})`);
}
L(`\n(${orphanHandlers.length} unused handlers of ${new Set(be.map(handlerKey)).size} handlers / ${be.length} URLs)`);
L("");

H("Backend endpoints called by web but not mobile");
const wOnly = be.filter((r) => isUsedByWeb(r) && !isUsedByMob(r));
for (const r of wOnly) L(`- \`${r.method} ${r.path}\` (${r.file})`);
L(`\n(${wOnly.length})`);
L("");

H("Backend endpoints called by mobile but not web");
const mOnly = be.filter((r) => !isUsedByWeb(r) && isUsedByMob(r));
for (const r of mOnly) L(`- \`${r.method} ${r.path}\` (${r.file})`);
L(`\n(${mOnly.length})`);
L("");

H("Web endpoints not called by mobile (same as above, from the web side)");
const seen = new Set();
for (const w of web) {
  const k = `${normMethod(w.method)} ${normPath(w.path)}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const r = match(w.method, w.path);
  if (r.kind === "none" || !r.rows.length) continue;
  if (!r.rows.some((x) => isUsedByMob(x))) L(`- \`${k}\` — ${w.file}:${w.line}`);
}

// per-module matrix (handler-level)
const modules = new Map();
const moduleOf = (r) => r.module || "(un-gated: auth/store/superadmin/plans/webhooks/uploads/health)";
const seenH = new Set();
for (const r of be) {
  const hk = handlerKey(r);
  if (seenH.has(hk)) continue;
  seenH.add(hk);
  const m = moduleOf(r);
  if (!modules.has(m)) modules.set(m, { total: 0, web: 0, mob: 0, orphan: [] });
  const e = modules.get(m);
  e.total++;
  const w = handlerUsedWeb.has(hk);
  const m2 = handlerUsedMob.has(hk);
  if (w) e.web++;
  if (m2) e.mob++;
  if (!w && !m2) e.orphan.push(`${r.method} ${r.path}`);
}
const M = ["# Per-module endpoint usage matrix (handler-level)", "", "| plan module | handlers | used by web | used by mobile | used by neither |", "|---|---|---|---|---|"];
for (const [m, e] of [...modules.entries()].sort()) M.push(`| ${m} | ${e.total} | ${e.web} | ${e.mob} | ${e.orphan.length} |`);
M.push("", "## Unused handlers by module");
for (const [m, e] of [...modules.entries()].sort()) {
  M.push(`### ${m}`);
  if (!e.orphan.length) M.push("- (all integrated)");
  else for (const o of e.orphan) M.push(`- \`${o}\``);
}
fs.writeFileSync(path.join(root, "audit/module-matrix.md"), M.join("\n") + "\n");
console.log("wrote audit/module-matrix.md");

// full per-endpoint integration table
const H2 = ["module,method,path,file,export,auth,validation,usedWeb,usedMobile"];
const seenH2 = new Set();
for (const r of be) {
  const hk = handlerKey(r);
  if (seenH2.has(hk)) continue;
  seenH2.add(hk);
  H2.push(
    [
      r.module || "UNGATED",
      r.method,
      `"${r.path}"`,
      r.file,
      r.export,
      `"${r.auth}"`,
      r.validation,
      handlerUsedWeb.has(hk) ? "yes" : "no",
      handlerUsedMob.has(hk) ? "yes" : "no",
    ].join(","),
  );
}
fs.writeFileSync(path.join(root, "audit/module-endpoints.csv"), H2.join("\n") + "\n");
console.log("wrote audit/module-endpoints.csv");

fs.writeFileSync(path.join(root, "audit/crossmatch.md"), R.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      backendEndpoints: be.length,
      webCallSites: web.length,
      mobileCallSites: liveMobileEndpoints.length,
      mobileDeadDefs: deadMobileEndpoints.length,
      webUnmatched: unmatchedWeb.length,
      mobileUnmatched: unmatchedMob.length,
      orphanBackendHandlers: orphanHandlers.length,
      webOnly: wOnly.length,
      mobileOnly: mOnly.length,
    },
    null,
    2,
  ),
);
