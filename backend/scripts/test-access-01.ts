/**
 * Regression test — access-01: per-shop page & feature access catalog.
 *
 * FAILS BEFORE the feature: lib/pages.ts did not exist and no page/feature
 *   override model was available.
 * PASSES AFTER: the catalog maps every permission flag to its page, resolves
 *   module→page relationships, and buildAccessView() reports a page as enabled
 *   only when the plan includes its module AND no store override turns it off.
 *
 * Pure helpers only (no DB). Run:  npx tsx scripts/test-access-01.ts
 */
export {};

let failed = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/mazedukan";

  const {
    ACCESS_KEYS,
    APP_PAGES,
    PAGE_KEY_BY_FLAG,
    buildAccessView,
    isFlagDisabled,
    isKnownAccessKey,
    isModuleDisabled,
    pagesForModule,
  } = await import("../src/lib/pages.js");
  const { PERMISSION_FLAGS } = await import("../src/lib/permissions.js");
  const { PLAN_MODULE_KEYS } = await import("../src/lib/plans.js");

  const pageKeys = new Set(APP_PAGES.map((p) => p.key));
  check("dashboard is a known page", pageKeys.has("dashboard"));
  check("settings is a known page", pageKeys.has("settings"));

  check("every permission flag maps to a page", PERMISSION_FLAGS.every((f) => Boolean(PAGE_KEY_BY_FLAG[f])));
  check("can_manage_products maps to the products page", PAGE_KEY_BY_FLAG.can_manage_products === "products");
  check("can_manage_users maps to the users page", PAGE_KEY_BY_FLAG.can_manage_users === "users");

  check("page keys are accepted access keys", isKnownAccessKey("invoices") === true);
  check("feature flags are accepted access keys", isKnownAccessKey("can_view_reports") === true);
  check("unknown keys are rejected", isKnownAccessKey("can_launch_rockets") === false);

  const empty = new Set<string>();
  check("nothing is disabled by default", isFlagDisabled(empty, "can_manage_products") === false);

  const byFlag = new Set<string>(["can_manage_products"]);
  check("disabling a flag blocks that flag", isFlagDisabled(byFlag, "can_manage_products") === true);
  check("disabling a flag leaves other flags alone", isFlagDisabled(byFlag, "can_manage_invoices") === false);

  const byPage = new Set<string>(["products"]);
  check("disabling a page blocks its feature flag", isFlagDisabled(byPage, "can_manage_products") === true);

  check("CUSTOMERS_UDHAARI backs two pages", pagesForModule("CUSTOMERS_UDHAARI").length === 2);
  check("disabling one of two pages does not block the module", isModuleDisabled(new Set(["customers"]), "CUSTOMERS_UDHAARI") === false);
  check(
    "disabling both pages blocks the module",
    isModuleDisabled(new Set(["customers", "udhaari"]), "CUSTOMERS_UDHAARI") === true,
  );
  check("a module with no page is never blocked", isModuleDisabled(new Set(["dashboard"]), "API_ACCESS") === false);

  const fakePlan = {
    modules: [
      { moduleKey: "DASHBOARD", enabled: true, limitValue: null },
      { moduleKey: "PRODUCTS", enabled: true, limitValue: null },
      { moduleKey: "SALES_INVOICES", enabled: false, limitValue: null },
    ],
  } as unknown as Parameters<typeof buildAccessView>[0];

  const view = buildAccessView(fakePlan, new Set(["products"]));
  const products = view.find((p) => p.key === "products")!;
  const invoices = view.find((p) => p.key === "invoices")!;
  const settings = view.find((p) => p.key === "settings")!;

  check("plan-enabled page with an override is off", products.includedInPlan === true && products.enabled === false);
  check("plan-disabled page is off", invoices.includedInPlan === false && invoices.enabled === false);
  check("module-less page is included by plan", settings.includedInPlan === true && settings.enabled === true);

  check(
    "only valid module keys are referenced by pages",
    APP_PAGES.every((p) => p.moduleKey === null || (PLAN_MODULE_KEYS as readonly string[]).includes(p.moduleKey)),
  );

  console.log(failed === 0 ? "\nAll access tests passed." : `\n${failed} access test(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
