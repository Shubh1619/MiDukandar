// Build qa-report deliverables from _data/results.jsonl
// Run from repo root:  node qa-report/scripts/build-report.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./lib.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "qa-report");

const raw = await readFile(path.join(DATA_DIR, "results.jsonl"), "utf8");
const rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));

// Dedupe by id, keeping the LAST record (latest run).
const byId = new Map();
for (const r of rows) byId.set(r.id, r);
const secOf = (id) => (id || "?").charAt(0).toUpperCase();
const all = [...byId.values()].sort((a, b) => {
  const s = secOf(a.id).localeCompare(secOf(b.id));
  if (s) return s;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
});

const count = (st) => all.filter((r) => r.status === st).length;
const fails = all.filter((r) => r.status === "FAIL");
const warns = all.filter((r) => r.status === "WARN");
const manuals = all.filter((r) => r.status === "MANUAL");
const passes = all.filter((r) => r.status === "PASS");
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

// ---------------------------------------------------------------- test-cases.csv
const header = ["id", "section", "title", "status", "severity", "expected", "actual", "notes"];
const csvLines = [header.join(",")];
for (const r of all) {
  csvLines.push([r.id, secOf(r.id), r.title, r.status, r.severity, r.expected, r.actual, r.notes].map(csv).join(","));
}
await writeFile(path.join(OUT, "test-cases.csv"), csvLines.join("\r\n") + "\r\n");

// ---------------------------------------------------------------- SUMMARY.md
const now = new Date().toISOString();
const tbl = (list) => {
  if (!list.length) return "_None._\n";
  let s = "| ID | Title | Severity | Expected | Actual |\n|---|---|---|---|---|\n";
  for (const r of list) s += `| ${r.id} | ${r.title} | ${r.severity || "-"} | ${r.expected} | ${r.actual} |\n`;
  return s;
};

const summary = `# MiDukandar QA Report - Summary

- **Date:** ${now.slice(0, 10)}
- **Scope:** LOCAL stack only (backend http://localhost:4000, web http://localhost:3000, Postgres via docker). No production/Render or Brevo egress was exercised.
- **Method:** Automated black-box API tests (Node harness under \`qa-report/scripts/\`) plus source review for root-cause. Mobile app is **manual** (no integration_test/Playwright available).
- **Accounts:** store1 owner (Pro), store2 owner (Free), manager/cashier/staff on store1, platform superadmin.

## Totals

| Status | Count |
|---|---|
| PASS | ${count("PASS")} |
| FAIL | ${count("FAIL")} |
| WARN | ${count("WARN")} |
| MANUAL | ${count("MANUAL")} |
| **Total** | **${all.length}** |

By section: ${["A", "B", "C", "D", "E", "F", "G"].map((s) => `${s}=${all.filter((r) => secOf(r.id) === s && r.status === "PASS").length}/${all.filter((r) => secOf(r.id) === s).length}`).join(", ")}

## Failures

${tbl(fails)}

## Warnings

${tbl(warns)}

## Manual / not automatable

${manuals.length ? manuals.map((r) => `- **${r.id}** ${r.title} - ${r.notes}`).join("\n") : "_None._"}

## Coverage notes

- Sections A-E and G are API-automated end to end. Section F automates web reachability, redirects, security headers and CORS; UI/UX remains manual.
- Recurring-expense API exists but no web/mobile client calls it (see warning C32).
- Full raw results: \`qa-report/_data/results.jsonl\`; case table: \`qa-report/test-cases.csv\`.
`;
await writeFile(path.join(OUT, "SUMMARY.md"), summary);

// ---------------------------------------------------------------- bugs.md
const sevRank = { high: 0, medium: 1, low: 2, "": 3 };
const bugs = [...fails, ...warns].sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3));

const known = {
  E15: {
    impact: "A suspended tenant (billing/non-payment enforcement) keeps full API access; suspension is cosmetic.",
    root: "\`authenticate()\` in backend/src/middlewares/auth.ts validates the JWT but never loads/checks \`stores.status\`, so \`SUSPENDED\` stores continue to read/write.",
    fix: "In the auth pre-handler (or a store-status guard) look up the store and reject with 403 \`STORE_SUSPENDED\` when status != 'ACTIVE' (allow superadmin impersonation tokens through).",
  },
  B09: {
    impact: "A CASHIER can create products, contradicting the advertised role matrix (DEFAULT_PERMISSIONS.CASHIER.can_manage_products=false).",
    root: "POST/PUT/DELETE product routes gate on \`authenticate\` + a coarse role check that includes CASHIER; the per-role permission flags (checkPermission) are never consulted.",
    fix: "Centralize authorization: enforce DEFAULT_PERMISSIONS flags server-side for products/sales/expenses/etc., or tighten the product route's requireRole to OWNER/MANAGER/STOCK_MANAGER.",
  },
  "B24-flags": {
    impact: "The /api/roles permission matrix is advisory only; any UI that hides a button based on it can be bypassed by calling the API.",
    root: "\`checkPermission()\` is defined in middlewares/auth.ts but not referenced by any route.",
    fix: "Wire checkPermission into routes that map to a permission key, or delete the flag matrix to avoid a false sense of security.",
  },
  C03: {
    impact: "Duplicate products with the same name are created silently whenever the incoming product has a SKU/barcode, or the existing one does. Inflates catalogue, splits stock.",
    root: "findDuplicate() only evaluates the name clause when the INCOMING input has no sku AND no barcode, and the clause itself requires the EXISTING row to have \`sku IS NULL AND barcode IS NULL\`.",
    fix: "Always compare a normalized name within the store regardless of sku/barcode presence, while still allowing a distinct sku/barcode to be a separate explicit signal.",
  },
  D10: {
    impact: "Invalid \`from\`/\`to\` dates crash reports (500) instead of a 400 validation error; the Postgres error code is echoed to the caller.",
    root: "\`dateRangeSchema\` accepts any string; the value is passed to Postgres, which raises 22007 (invalid_datetime_format), and the global error handler serializes \`err.code\`.",
    fix: "Validate ISO dates in dateRangeSchema (z.coerce.date or regex) and stop returning raw DB error codes in responses.",
  },
  G10: {
    impact: "GET /api/products/:id with a non-UUID id returns 500 (PG 22P02) instead of 400.",
    root: "\`:id\` params are not schema-validated as UUID on the product routes (other routes do use zod UUID params).",
    fix: "Validate path params with \`z.object({ id: z.string().uuid() })\` consistently.",
  },
  G09: {
    impact: "/api/reports/stock/movements returns 500 whenever \`search\` or \`category\` is supplied - the filter is unusable.",
    root: "The report query filters on \`p.name\`/\`p.category\` but selects \`FROM products\` without the \`p\` alias ('missing FROM-clause entry for table \"p\"'). Values are still parameterized (not injectable), so this is a functional bug, not SQLi.",
    fix: "Alias the table (FROM products p) in getStockMovementReport, matching the other report queries.",
  },
  "G09c": {
    impact: "Internal Postgres error codes (22P02/22007/42P01) are returned in JSON error bodies.",
    root: "The global error handler includes \`err.code\` for unhandled DB errors.",
    fix: "Log the code server-side; return a generic \`{ error, code: 'INTERNAL' }\` to clients.",
  },
  A05: {
    impact: "Account enumeration: POST /auth/otp/request returns 404 ACCOUNT_NOT_FOUND for unknown emails and 200 for known ones.",
    root: "The route resolves the user before deciding the response.",
    fix: "Always return the same 200 'OTP sent' generic response for both cases (send a 'no account' email instead).",
  },
  A06: {
    impact: "In non-production builds the OTP is returned in the response body (\`devOtp\`), defeating OTP secrecy if a dev/staging build is exposed.",
    root: "\`sendMail\`/OTP route returns the code when \`config.mailMode === 'log'\` (dev).",
    fix: "Keep devOtp behind an explicit \`QA_OTP_ECHO\` flag; never echo in any deployment that could be reached over a network.",
  },
  C32: {
    impact: "Credit-recurring-expense API is internally inconsistent: list lives at \`/recurring-expenses/recurring\` while create/update/delete use \`/recurring-expenses\`; \`GET /recurring-expenses\` 404s. No client uses it.",
    root: "recurringExpenseRoutes mounts the list handler with an extra '/recurring' segment.",
    fix: "Align the list path with the rest of the router (or remove the route entirely if unused).",
  },
  F05: { impact: "Web responses omit Strict-Transport-Security.", root: "No HSTS header configured in next.config / proxy.", fix: "Add HSTS (and re-check CSP) at the edge for HTTPS deployments." },
  F06: { impact: "API responses omit X-Content-Type-Options: nosniff.", root: "No security headers plugin on Fastify.", fix: "Add @fastify/helmet on the backend." },
  F09b: { impact: "No /robots.txt on the web app.", root: "Missing static file.", fix: "Add robots.txt (and sitemap) for SEO hygiene." },
};

let bugsMd = `# MiDukandar QA Report - Bugs & Warnings

Ordered by severity. Each item lists expected vs actual plus a source-level root cause and suggested fix.

`;
for (const r of bugs) {
  const k = known[r.id] ?? {};
  bugsMd += `## ${r.id} - ${r.title}\n\n`;
  bugsMd += `- **Status:** ${r.status}  **Severity:** ${r.severity || "n/a"}\n`;
  bugsMd += `- **Expected:** ${r.expected || "-"}\n`;
  bugsMd += `- **Actual:** ${r.actual || "-"}\n`;
  if (r.evidence) bugsMd += `- **Evidence:** \`${r.evidence}\`\n`;
  if (r.notes) bugsMd += `- **Notes:** ${r.notes}\n`;
  if (k.impact) bugsMd += `- **Impact:** ${k.impact}\n- **Root cause:** ${k.root}\n- **Suggested fix:** ${k.fix}\n`;
  bugsMd += "\n";
}
await writeFile(path.join(OUT, "bugs.md"), bugsMd);

// ---------------------------------------------------------------- security-and-permissions.md
const inSec = (s) => all.filter((r) => secOf(r.id) === s);
const line = (r) => `- ${r.status === "PASS" ? "PASS" : r.status === "WARN" ? "WARN" : "FAIL"} - \`${r.id}\` ${r.title}${r.status !== "PASS" ? ` (${r.actual})` : ""}`;

const sec = `# MiDukandar QA Report - Security & Permissions

## Authentication (Section A)
${all.filter((r) => secOf(r.id) === "A").map((r) => `- ${r.status === "PASS" ? "PASS" : r.status}  ${r.id}: ${r.title}${r.status !== "PASS" ? ` - ${r.actual}` : ""}`).join("\n")}

## Authorization, tenant isolation, plan gating (Section B)

### Role checks
${all.filter((r) => secOf(r.id) === "B" && /^B0|^B1[12]/.test(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title}`).join("\n")}

### Cross-tenant isolation
${all.filter((r) => ["B13", "B14", "B15", "B16", "B17", "G01", "G02", "G03", "G04", "G05", "G06", "G07"].includes(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}

### Plan / module gating
${all.filter((r) => ["B18", "B19", "B20", "B21", "B22", "B23", "B23b", "B24", "B23b-check"].includes(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title}`).join("\n")}

**Finding:** the per-role permission flags exposed by \`/api/roles\` are not enforced server-side (\`checkPermission()\` is dead code). \`POST /api/products\` accepts CASHIER (B09). Treat the matrix as UI-only until wired.

## Security probes (Section G)

### Injection & input validation
${all.filter((r) => /^G0[89]|^G1[0-1]/.test(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}

- All JSON/SQL values in product/report queries are **parameterized**; the report-filter 500 (G09) is an alias bug, not an injection.

### Token integrity & mass assignment
${all.filter((r) => /^G12/.test(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}

### Privilege & data exposure
${all.filter((r) => /^G1[3-9]|^G20/.test(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}

## Platform / superadmin (Section E)
${all.filter((r) => secOf(r.id) === "E").map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}

**Finding (high):** suspending a tenant (E15) does not block API access - suspension is not enforced in \`authenticate()\`.

## Platform hardening (Section F)
${all.filter((r) => ["F05", "F06", "F07", "F08", "F09"].includes(r.id)).map((r) => `- ${r.id} ${r.status} - ${r.title} (${r.actual})`).join("\n")}
`;
await writeFile(path.join(OUT, "security-and-permissions.md"), sec);

// ---------------------------------------------------------------- ux-feedback.md
const ux = `# MiDukandar QA Report - UX Feedback

## Automated observations

- **Validation messages** are present and structured (\`{ error, code }\`) for the happy-path 400s (sale qty=0, empty lines, negative discount, gst>100, zero-amount expense, overpayment). Good.
- **Two failure modes leak implementation detail to users/operators:** invalid date -> 500 with a raw PG code (D10, G09c) and non-UUID ids -> 500 (G10). These present as generic "Internal server error" in the UI.
- **Stock-movement report filter is broken** (G09): choosing any search term/category shows an error instead of filtered rows.
- **Duplicate product names are accepted** when a SKU is involved (C03) - users can accidentally create two "Tata Salt" rows and split stock.
- **i18n:** web en=hi=mr=332 keys and guard passes (\`web/scripts/i18n-check.mjs\`); mobile ARB parity via \`flutter gen-l10n\`. No drift detected at this revision.

## Manual checklist (not automatable here)

These require a device/emulator or a browser session and must be run by a human:

1. **Onboarding/OTP** - request code, wrong code, resend, expiry, "too many requests" copy.
2. **Invoice builder** - add/remove lines, barcode scan, discount (flat/%), GST preview, hold + resume, print/share PDF.
3. **Offline/slow network** - loading states, retries, error toasts on timeout.
4. **Reports** - P&L and GST screens match the API numbers; date-range picker edge cases.
5. **Supplier payment history** - list, amount entry, overpayment guard message.
6. **Referral** - invite link, \`/onboard?ref=\`, credit visible in Settings > Refer.
7. **Responsive** - web at 360/768/1280px; mobile portrait + landscape.
8. **Accessibility** - keyboard focus order, contrast, screen-reader labels on icon buttons.

## Suggested UX follow-ups

- Give the stock-movement filter a user-facing "temporarily unavailable" state (until G09 is fixed) to avoid a hard error page.
- Surface duplicate-name conflicts inline in the product form, including when a SKU is present.
- Replace generic 500 copy with "Something went wrong, please retry" plus a support code that maps to the server log (never the raw PG code).
`;
await writeFile(path.join(OUT, "ux-feedback.md"), ux);

// ---------------------------------------------------------------- improvement-options.md
const imp = `# MiDukandar - Improvement Options

Prioritized, low-risk options derived from this QA pass. Nothing here has been implemented; pick the ones you want.

## P0 - correctness & trust (recommend first)

1. **Enforce tenant suspension** (bug E15). Load \`stores.status\` in the auth guard and reject non-ACTIVE stores with 403. Impact: high, effort: small.
2. **Enforce role permissions server-side** (bugs B09, B24-flags). Either wire \`checkPermission()\` into the routes or tighten \`requireRole\` on product/expense routes. Impact: high, effort: medium.
3. **Fix stock-movement report filter** (bug G09). Add the missing \`p\` alias. Impact: medium, effort: tiny.
4. **Validate dates & UUID path params; stop leaking PG codes** (bugs D10, G10, G09c). Add zod schemas and a generic internal-error body. Impact: medium, effort: small.

## P1 - data quality & API hygiene

5. **Robust duplicate detection** (bug C03). Always normalize+compare name; keep sku/barcode exact matches. Impact: medium, effort: small.
6. **Consistent recurring-expense surface** (bug C32). Align list path or remove the unused router. Impact: low-medium, effort: small.
7. **Account-enumeration-safe OTP** (bug A05). Return a uniform 200 for unknown emails. Impact: medium, effort: small.
8. **Gate \`devOtp\` behind an explicit env flag** (bug A06). Impact: medium (if any non-prod build is reachable), effort: tiny.

## P2 - hardening & polish

9. **Security headers** (bugs F05, F06). Add \`@fastify/helmet\` (backend) and HSTS at the edge (web). Impact: low, effort: tiny.
10. **robots.txt / sitemap** (bug F09b). SEO hygiene. Impact: low, effort: tiny.
11. **Better error copy** (see ux-feedback). Impact: low, effort: small.

## Notes
- Out of scope for the local pass: Render 508 routing and Brevo egress-IP whitelisting (see repo notes); these need environment changes, not code.
- If you want, I can implement P0 as a single focused change set and re-run the automated suite to prove the failures flip to PASS.
`;
await writeFile(path.join(OUT, "improvement-options.md"), imp);

console.log(`built deliverables from ${all.length} unique cases (${count("PASS")} PASS / ${count("FAIL")} FAIL / ${count("WARN")} WARN / ${count("MANUAL")} MANUAL)`);
