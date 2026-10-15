/**
 * Regression test — P2-08: public GET /api/merchant/verify-context discloses PII.
 *
 * FAILS BEFORE the fix: the body carries merchantId / storeName / city /
 *   ownerName / gstin / terminalId and today's invoice, receipt and pending
 *   udhaari counts, and the route has no budget of its own (33 requests, 0 x 429).
 * PASSES AFTER the fix: the body is exactly { ok, matched } (no PII), and the
 *   route is rate-limited per IP (429 observed past the budget).
 *
 * No rows are written; read-only against the seeded dev DB.
 *
 * Run:  npx tsx scripts/test-p2-08.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const REGISTERED_PHONE = "9876543210";
const UNKNOWN_PHONE = "9000000000";
const ROUTE_BUDGET = 30;

const PII_KEYS = [
  "merchantId",
  "storeName",
  "city",
  "ownerName",
  "ownerInitials",
  "gstin",
  "terminalId",
  "ledgerStatus",
  "todayInvoices",
  "pendingUdhaari",
  "receipts",
];

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

/** Collects every object key at any depth, so nested PII cannot hide. */
function allKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

function leakedKeys(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return PII_KEYS.filter((k) => raw.includes(k));
  }
  const keys = allKeys(parsed);
  return PII_KEYS.filter((k) => keys.has(k));
}

async function main(): Promise<void> {
  const app = buildApp({ logger: false });
  await app.ready();

  const hit = await app.inject({ method: "GET", url: `/api/merchant/verify-context?mobile=${REGISTERED_PHONE}` });
  check("registered number → HTTP 200", hit.statusCode === 200, `got ${hit.statusCode}`);
  const body = (hit.json() ?? {}) as Record<string, unknown>;
  const leaked = leakedKeys(hit.body);
  check("no PII in the registered-number response", leaked.length === 0, leaked.length ? `leaked: ${leaked.join(", ")} | body=${hit.body}` : "");
  check("shape is { ok: true, matched: boolean }", body.ok === true && typeof body.matched === "boolean", `body=${hit.body}`);
  check("registered number is reported as matched", body.matched === true, `matched=${String(body.matched)}`);

  const miss = await app.inject({ method: "GET", url: `/api/merchant/verify-context?mobile=${UNKNOWN_PHONE}` });
  const mbody = (miss.json() ?? {}) as Record<string, unknown>;
  check("unknown number → HTTP 200, matched false (same shape, no status oracle)", miss.statusCode === 200 && mbody.matched === false, `status=${miss.statusCode} body=${miss.body}`);
  const mleaked = leakedKeys(miss.body);
  check("unknown number response carries no PII", mleaked.length === 0, mleaked.length ? `leaked: ${mleaked.join(", ")}` : "");

  let first429At = -1;
  let total429 = 0;
  for (let i = 1; i <= ROUTE_BUDGET + 3; i += 1) {
    const r = await app.inject({ method: "GET", url: `/api/merchant/verify-context?mobile=${REGISTERED_PHONE}` });
    if (r.statusCode === 429) {
      total429 += 1;
      if (first429At < 0) first429At = i;
    }
  }
  check("route is rate-limited (429 past the budget)", total429 > 0, `first 429 on loop request #${first429At} (${total429} total)`);

  const limited = await app.inject({ method: "GET", url: `/api/merchant/verify-context?mobile=${REGISTERED_PHONE}` });
  const limitedBody = (limited.json() ?? {}) as Record<string, unknown>;
  check("429 payload carries code RATE_LIMITED", limited.statusCode !== 429 || limitedBody.code === "RATE_LIMITED", `body=${limited.body}`);

  await pool.end();
  console.log(failed > 0 ? `\nP2-08 TEST FAILED: ${failed} check(s)` : "\nP2-08 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
