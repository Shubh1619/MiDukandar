import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROUTES = path.join(process.cwd(), "backend", "src", "routes");
const dir = await readdir(ROUTES);
const rows = [];
for (const name of dir.filter((f) => f.endsWith(".ts")).sort()) {
  const src = await readFile(path.join(ROUTES, name), "utf8");
  const re = /\.(get|post|put|patch|delete)\(\s*[`"']([^`"']+)[`"']/g;
  let m;
  while ((m = re.exec(src))) rows.push({ file: name, method: m[1].toUpperCase(), path: m[2] });
}
const out = path.join(process.cwd(), "qa-report", "_data", "endpoints.txt");
await (await import("node:fs/promises")).mkdir(path.dirname(out), { recursive: true });
await (await import("node:fs/promises")).writeFile(
  out,
  rows.map((r) => `${r.method.padEnd(6)} ${r.file.padEnd(26)} ${r.path}`).join("\n"),
);
console.log(`total ${rows.length} route defs`);
for (const r of rows) console.log(`${r.method.padEnd(6)} ${r.file.padEnd(26)} ${r.path}`);
