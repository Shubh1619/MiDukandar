import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const webSrc = path.join(root, "web/src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(webSrc);
const rows = [];

const HELPERS = "apiFetch|apiDownload|apiUploadFile|saFetch";

for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, "/");
  if (rel.endsWith("lib/api.ts") || rel.endsWith("lib/superadmin-api.ts")) continue;
  const src = fs.readFileSync(f, "utf8");

  const re = new RegExp(`\\b(${HELPERS})(?:\\s*<[^(]*>)?\\s*\\(\\s*(?:\\n\\s*)?("([^"]+)"|'([^']+)'|\`([^\`]+)\`|([A-Za-z_$][\\w$]*))`, "g");
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    const fn = m[1];
    let arg = m[3] ?? m[4] ?? m[5] ?? "";
    if (!arg) arg = m[6] ? `<var:${m[6]}>` : "<dynamic>";

    // bound the options window: stop at next helper call or first top-level `)`
    let win = src.slice(m.index + m[0].length, m.index + m[0].length + 500);
    const stop = win.search(new RegExp(`\\b(${HELPERS})\\s*\\(`));
    if (stop > -1) win = win.slice(0, stop);
    const close = win.indexOf(")");
    if (close > -1) win = win.slice(0, close);

    let method =
      win.match(/method:\s*(?:["']([A-Z]+)["']|Method\.([A-Z]+))/)?.[1] ??
      win.match(/method:\s*(?:["']([A-Z]+)["']|Method\.([A-Z]+))/)?.[2] ??
      "";
    if (!method) {
      if (fn === "apiDownload") method = "GET";
      else if (fn === "apiUploadFile") method = "POST";
      else method = /\bbody\s*:/.test(win) ? "POST" : "GET";
    }
    if (fn === "apiDownload") method = "GET";
    if (fn === "apiUploadFile") method = "POST";

    rows.push({ file: rel, line, fn, method, path: arg });
  }

  // bare fetch("/api/...")
  const fre = /\bfetch\(\s*("([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  let fm;
  while ((fm = fre.exec(src))) {
    const arg = fm[2] ?? fm[3] ?? fm[4] ?? "";
    if (!arg.startsWith("/api/")) continue;
    const line = src.slice(0, fm.index).split("\n").length;
    if (rows.some((r) => r.file === rel && r.line === line)) continue;
    const win = src.slice(fm.index, fm.index + 300);
    const method = win.match(/method:\s*["']([A-Z]+)["']/)?.[1] ?? (/\bbody\s*:/.test(win) ? "POST" : "GET");
    rows.push({ file: rel, line, fn: "fetch", method, path: arg });
  }
}

rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const out = ["file,line,helper,method,path"];
for (const r of rows) out.push([r.file, r.line, r.fn, r.method, `"${r.path.replace(/"/g, "'")}"`].join(","));
fs.writeFileSync(path.join(root, "audit/web-calls.csv"), out.join("\n") + "\n");

console.log("web call sites:", rows.length);
const byKey = new Map();
for (const r of rows) {
  const p = r.path.replace(/\$\{[^}]*\}/g, ":x").replace(/\?.*$/, "?…");
  const k = `${r.method} ${p}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(`${r.file}:${r.line}`);
}
console.log("distinct:", byKey.size);
for (const k of [...byKey.keys()].sort()) console.log(`  ${k}   [${byKey.get(k).length}] ${byKey.get(k)[0]}`);
