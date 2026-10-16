import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routesDir = path.join(root, "backend/src/routes");
const appSrc = fs.readFileSync(path.join(root, "backend/src/app.ts"), "utf8");

// exportName -> Set<prefix> (an export can be registered under >1 prefix)
const prefixesByExport = new Map();
for (const m of appSrc.matchAll(/app\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*"([^"]+)"/g)) {
  if (!prefixesByExport.has(m[1])) prefixesByExport.set(m[1], new Set());
  prefixesByExport.get(m[1]).add(m[2]);
}

const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".routes.ts"));
const srcByFile = {};
const exportDeclsByFile = {};
for (const f of files) {
  srcByFile[f] = fs.readFileSync(path.join(routesDir, f), "utf8");
  exportDeclsByFile[f] = [...srcByFile[f].matchAll(/^export\s+(?:async\s+)?(?:const|function)\s+(\w+)/gm)].map(
    (m) => ({ name: m[1], index: m.index, line: srcByFile[f].slice(0, m.index).split("\n").length }),
  );
}

// nested callers: childPluginName -> Set<{file,index} of calling export
const callersOf = new Map();
const nestedRe = /(?:await\s+)?(\w+Routes)\(app\)/g;
for (const f of files) {
  for (const d of exportDeclsByFile[f]) {
    const body = srcByFile[f].slice(d.index);
    let m;
    nestedRe.lastIndex = 0;
    while ((m = nestedRe.exec(body))) {
      if (!callersOf.has(m[1])) callersOf.set(m[1], []);
      callersOf.get(m[1]).push({ file: f, export: d.name });
    }
  }
}

function prefixesFor(exportName, file) {
  const own = prefixesByExport.get(exportName);
  if (own) return [...own];
  // child plugin: inherit the prefixes of the export that calls it
  const callers = callersOf.get(exportName) ?? [];
  const set = new Set();
  for (const c of callers) for (const p of prefixesFor(c.export, c.file)) set.add(p);
  return [...set];
}

const moduleKeyByPrefix = {};
{
  const block = appSrc.match(/PLAN_ROUTE_MODULES[\s\S]{0,900}?];/)?.[0] ?? "";
  for (const m of block.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)) moduleKeyByPrefix[m[1]] = m[2];
}

const GUARD_RE =
  /(authenticate|requireStore|requireRole\([^)]*\)|requireModuleAccess\([^)]*\)|requireSuperAdmin|requireSuperadminAuth)/g;
const routeRe = /app\.(get|post|put|patch|delete)\(\s*("([^"]+)"|'([^']+)'|`([^`]+)`)/g;

const rows = [];

for (const f of files) {
  const src = srcByFile[f];
  const decls = exportDeclsByFile[f];
  const fileHook = [...src.matchAll(/app\.addHook\(\s*"preHandler"\s*,\s*(\w+)/g)].map((m) => m[1]);
  const registeredExportNames = decls.map((d) => d.name).filter((n) => prefixesByExport.has(n) || callersOf.has(n));
  const registered = registeredExportNames.length > 0;

  decls.forEach((d, di) => {
    const bodyEnd = di + 1 < decls.length ? decls[di + 1].index : src.length;
    const body = src.slice(d.index, bodyEnd);
    const prefixes = prefixesFor(d.name, f);
    if (!prefixes.length) return;

    const matches = [...body.matchAll(routeRe)];

    matches.forEach((m, i) => {
      const start = m.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
      const region = body.slice(start, end);

      const method = m[1].toUpperCase();
      const raw = m[3] ?? m[4] ?? m[5] ?? "";
      const guardBlock = region.slice(0, 900);
      const guards = [...guardBlock.matchAll(GUARD_RE)].map((x) => x[1].replace(/\s+/g, ""));
      let auth;
      if (guards.length) auth = [...new Set(guards)].join("+");
      else if (fileHook.length) auth = fileHook.join("+") + "(plugin hook)";
      else auth = "PUBLIC";
      const validated = /(?:\bparse\(|paginationSchema|z\.object|safeParse\()/.test(guardBlock);

      for (const prefix of prefixes) {
        const full = prefix + (raw === "/" ? "" : raw);
        const module =
          Object.entries(moduleKeyByPrefix).find(([p]) => full === p || full.startsWith(p + "/"))?.[1] ?? "";
        rows.push({
          file: f,
          registered: true,
          export: d.name,
          method,
          path: full || "/",
          raw: raw || "/",
          auth,
          validation: validated ? "zod" : "NONE-DETECTED",
          module,
        });
      }
    });
  });
}

rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method) || a.export.localeCompare(b.export));

const out = ["file,registered,export,method,path,raw,auth,validation,plan_module"];
for (const r of rows)
  out.push(
    [r.file, r.registered ? "yes" : "NO", r.export, r.method, `"${r.path}"`, `"${r.raw}"`, `"${r.auth}"`, r.validation, r.module].join(","),
  );
fs.writeFileSync(path.join(root, "audit/endpoint-map.csv"), out.join("\n") + "\n");

console.log(`total route instances: ${rows.length}`);
console.log(`unique method+path: ${new Set(rows.map((r) => r.method + " " + r.path)).size}`);
const unreg = rows.filter((r) => !r.registered);
console.log(`unregistered: ${unreg.length}`);
console.log(`\nno validation detected (${rows.filter((r) => r.validation === "NONE-DETECTED").length}):`);
for (const r of rows.filter((r) => r.validation === "NONE-DETECTED")) console.log(`  ${r.method} ${r.path} (${r.file})`);
console.log(`\nPUBLIC (${rows.filter((r) => r.auth === "PUBLIC").length}):`);
for (const r of rows.filter((r) => r.auth === "PUBLIC")) console.log(`  ${r.method} ${r.path} (${r.file})`);
console.log("\nby export:");
const byExp = {};
for (const r of rows) {
  byExp[r.export] ??= { n: 0, prefixes: new Set() };
  byExp[r.export].n++;
}
for (const [k, v] of Object.entries(byExp)) console.log(`  ${k}: ${v.n} route instances`);
