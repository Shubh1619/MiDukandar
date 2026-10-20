/**
 * Regression test - fix-14: circular import between lib/plans.ts and lib/pages.ts.
 *
 * lib/pages.ts imports hasPlanModule from lib/plans.ts, and lib/plans.ts used to
 * import pagesForModule from lib/pages.ts at module scope. That cycle made the
 * pagesForModule binding depend on which module finished evaluating first, so a
 * partially-initialised load (observed live) threw
 * "ReferenceError: pagesForModule is not defined" from hasModuleAccess, turning
 * every authenticated request into a 500.
 *
 * PASSES AFTER: the import is resolved lazily inside hasModuleAccess, so module
 *   load order no longer matters. This test loads the middleware (which imports
 *   plans.ts) first to reproduce the app's real evaluation order, then calls
 *   hasModuleAccess through the same path the auth guard uses.
 *
 * Run:  npx tsx scripts/test-fix-14.ts     (exit 0 = PASS, 1 = FAIL)
 */
import "../src/middlewares/auth.js";
import { pool } from "../src/db/pool.js";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`[PASS] ${name} :: ${detail}`);
  } else {
    failures += 1;
    console.log(`[FAIL] ${name} :: ${detail}`);
  }
}

const { hasModuleAccess } = await import("../src/lib/plans.js");
const { pagesForModule } = await import("../src/lib/pages.js");

try {
  const result = await hasModuleAccess("00000000-0000-0000-0000-000000000000", "PRODUCTS");
  check(
    "hasModuleAccess does not throw pagesForModule ReferenceError",
    typeof result === "boolean",
    `result=${result}`,
  );
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  check("hasModuleAccess does not throw pagesForModule ReferenceError", false, message);
}

check(
  "pagesForModule still resolves the mapping",
  pagesForModule("PRODUCTS").some((page) => page.key === "products"),
  JSON.stringify(pagesForModule("PRODUCTS").map((page) => page.key)),
);

if (failures > 0) {
  console.log(`\n${failures} CHECK(S) FAILED`);
  await pool.end();
  process.exit(1);
}
console.log("\nALL FIX-14 CHECKS PASSED");
await pool.end();
process.exit(0);
