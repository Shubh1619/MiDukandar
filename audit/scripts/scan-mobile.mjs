import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function walk(dir, out = [], skip = /(node_modules|\.next|build|generated)/) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, skip);
    else if (/\.dart$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, "app/lib"));
const svcFile = files.find((f) => f.endsWith("api_service.dart"));
const svcSrc = fs.readFileSync(svcFile, "utf8");
const svcRel = path.relative(root, svcFile).replace(/\\/g, "/");

const defs = [];
svcSrc.split("\n").forEach((l, i) => {
  if (!/Future</.test(l)) return;
  const m = l.match(/\b([A-Za-z_]\w*)\s*\(/);
  if (!m || /^(if|while|for|switch|catch|return|else|do)$/.test(m[1])) return;
  defs.push({ name: m[1], line: i + 1 });
});

const rows = [];
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, "/");
  if (rel.endsWith("services/api_service.dart")) continue;
  const srcLines = fs.readFileSync(f, "utf8").split("\n");
  srcLines.forEach((line, i) => {
    for (const d of defs) {
      const callRe = new RegExp(`\\.\\s*${d.name}\\s*\\(`);
      const defRe = new RegExp(`(Future<[^;]*|void|var|final|const)\\s+${d.name}\\s*\\(`);
      if (callRe.test(line) && !defRe.test(line)) {
        rows.push({ file: rel, line: i + 1, method: d.name });
        break;
      }
    }
  });
}

rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const out = ["file,line,method"];
for (const r of rows) out.push(`${r.file},${r.line},${r.method}`);
fs.writeFileSync(path.join(root, "audit/mobile-calls.csv"), out.join("\n") + "\n");

console.log(`api_service methods: ${defs.length}`);
console.log(`mobile call sites: ${rows.length}`);
const byMethod = new Map();
for (const r of rows) {
  if (!byMethod.has(r.method)) byMethod.set(r.method, []);
  byMethod.get(r.method).push(`${r.file}:${r.line}`);
}
console.log("\ncall frequency by method:");
for (const [m, locs] of [...byMethod.entries()].sort()) console.log(`  ${m}: ${locs.length}`);
console.log("\n=== api_service methods NEVER called from UI (dead API surface) ===");
for (const d of defs) if (!byMethod.has(d.name)) console.log(`  ${d.name} (${svcRel}:${d.line})`);
console.log("\n=== all call sites by method ===");
for (const [m, locs] of [...byMethod.entries()].sort()) console.log(`  ${m}: ${locs.join(", ")}`);
