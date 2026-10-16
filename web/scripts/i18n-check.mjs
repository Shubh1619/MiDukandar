#!/usr/bin/env node
// i18n integrity check for the MiDukandar web app.
// Fails (exit 1) when:
//   - a t("key") used in code has no entry in the English dictionary
//   - the hi/mr dictionaries are missing keys that exist in English
//   - a dictionary defines the same key twice
//   - a translated value is followed by a hardcoded English suffix like `}s`
// Run: node scripts/i18n-check.mjs   (or `npm run i18n:check`)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const srcDir = join(webRoot, "src");
const dictDir = join(srcDir, "lib", "i18n", "dictionaries");

function parseDictionary(label) {
  const file = join(dictDir, `${label}.ts`);
  const src = readFileSync(file, "utf8");
  const map = new Map();
  const dupes = [];
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,?/gm;
  let m;
  while ((m = re.exec(src))) {
    const key = m[1];
    if (map.has(key)) dupes.push(key);
    map.set(key, m[3] !== undefined ? m[3] : m[4]);
  }
  return { map, dupes };
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "dictionaries" || entry === "generated") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(p)) {
      acc.push(p);
    }
  }
  return acc;
}

const en = parseDictionary("en");
const hi = parseDictionary("hi");
const mr = parseDictionary("mr");

const used = new Map();
const concatHits = [];
let files = 0;
for (const file of walk(srcDir)) {
  files++;
  const src = readFileSync(file, "utf8");
  const rel = relative(webRoot, file).replace(/\\/g, "/");
  let m;
  const keyRe = /\bt\(\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]/g;
  while ((m = keyRe.exec(src))) used.set(m[1], rel);
  // anti-pattern: a translated value immediately followed by a bare "s" suffix
  const concatRe = /t\(\s*["'`][A-Za-z0-9_]+["'`]\s*\)\s*\}s\b/g;
  let c;
  while ((c = concatRe.exec(src))) {
    const line = src.slice(0, c.index).split("\n").length;
    concatHits.push(`${rel}:${line}  ${c[0].trim()}`);
  }
}

const errors = [];
const warnings = [];

for (const [key, file] of used) {
  if (!en.map.has(key)) errors.push(`used key not in en: "${key}"  (${file})`);
}

for (const [key, value] of en.map) {
  if (!hi.map.has(key)) errors.push(`en key missing from hi: "${key}"`);
  if (!mr.map.has(key)) errors.push(`en key missing from mr: "${key}"`);
  if (value.includes("{{") && !/\{\{\w+\}\}/.test(value)) {
    warnings.push(`malformed placeholder in en "${key}": ${value}`);
  }
}

for (const [label, dict] of [["en", en], ["hi", hi], ["mr", mr]]) {
  for (const key of dict.dupes) errors.push(`duplicate key in ${label}.ts: "${key}"`);
}

for (const [key] of hi.map) if (!en.map.has(key)) warnings.push(`hi has key not in en: "${key}"`);
for (const [key] of mr.map) if (!en.map.has(key)) warnings.push(`mr has key not in en: "${key}"`);

for (const hit of concatHits) errors.push(`hardcoded suffix after t(): ${hit}`);

console.log(`i18n-check: scanned ${files} files; en=${en.map.size} hi=${hi.map.size} mr=${mr.map.size}; used=${used.size}`);
for (const w of warnings) console.log(`  warn: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} i18n error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("i18n-check: OK");
