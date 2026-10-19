/**
 * Per-shop page & feature access catalog.
 *
 * The platform superadmin can turn individual pages / feature flags OFF for a
 * specific shop (an extra restriction layer on top of the plan's modules and
 * the shop's role permissions). Only *disabled* keys are persisted in
 * `store_page_access`; absence means "no restriction".
 *
 * Keys are either a page key ("products") or a permission flag
 * ("can_manage_products"). This module is the single source of truth for both
 * the enforcement guards and the superadmin console.
 */

import { qClient, type DbClient, type Row } from "../db/pool.js";
import { PERMISSION_FLAGS, type PermissionFlag } from "./permissions.js";
import { hasPlanModule, type PlanDefinition, type PlanModuleKey } from "./plans.js";

export interface PageFeature {
  key: PermissionFlag;
  label: string;
}

export interface AppPage {
  key: string;
  label: string;
  moduleKey: PlanModuleKey | null;
  features: PageFeature[];
}

export const APP_PAGES: readonly AppPage[] = [
  { key: "dashboard", label: "Dashboard", moduleKey: "DASHBOARD", features: [] },
  {
    key: "products",
    label: "Products & Stock",
    moduleKey: "PRODUCTS",
    features: [{ key: "can_manage_products", label: "Manage products & stock" }],
  },
  {
    key: "invoices",
    label: "Sales & Invoices",
    moduleKey: "SALES_INVOICES",
    features: [{ key: "can_manage_invoices", label: "Manage sales & invoices" }],
  },
  {
    key: "customers",
    label: "Customers",
    moduleKey: "CUSTOMERS_UDHAARI",
    features: [{ key: "can_manage_customers", label: "Manage customers" }],
  },
  {
    key: "udhaari",
    label: "Udhaari",
    moduleKey: "CUSTOMERS_UDHAARI",
    features: [{ key: "can_manage_udhaari", label: "Manage udhaari / credit" }],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    moduleKey: "SUPPLIERS",
    features: [{ key: "can_manage_suppliers", label: "Manage suppliers" }],
  },
  {
    key: "expenses",
    label: "Expenses",
    moduleKey: "EXPENSES",
    features: [{ key: "can_manage_expenses", label: "Manage expenses" }],
  },
  {
    key: "reports",
    label: "GST & Reports",
    moduleKey: "GST_REPORTS",
    features: [{ key: "can_view_reports", label: "View reports" }],
  },
  {
    key: "settings",
    label: "Settings",
    moduleKey: null,
    features: [{ key: "can_manage_settings", label: "Manage settings" }],
  },
  {
    key: "users",
    label: "Users & Roles",
    moduleKey: "USERS_ROLES",
    features: [{ key: "can_manage_users", label: "Manage users & roles" }],
  },
];

/** Page that owns each feature flag (1:1 today). */
export const PAGE_KEY_BY_FLAG: Record<PermissionFlag, string> = (() => {
  const map = {} as Record<PermissionFlag, string>;
  for (const page of APP_PAGES) {
    for (const feature of page.features) map[feature.key] = page.key;
  }
  return map;
})();

/** Every key accepted by the superadmin access endpoint. */
export const ACCESS_KEYS: readonly string[] = [
  ...APP_PAGES.map((page) => page.key),
  ...PERMISSION_FLAGS,
];

export function isKnownAccessKey(key: string): boolean {
  return ACCESS_KEYS.includes(key);
}

export function pageByKey(key: string): AppPage | undefined {
  return APP_PAGES.find((page) => page.key === key);
}

/** Pages governed by a plan module (a module may back more than one page). */
export function pagesForModule(moduleKey: string): AppPage[] {
  return APP_PAGES.filter((page) => page.moduleKey === moduleKey);
}

/**
 * Reads the set of keys explicitly disabled for a store. Tolerates the table
 * being absent (pre-migration) by treating the store as unrestricted.
 */
export async function getDisabledAccessKeys(storeId: string, db: DbClient = qClient()): Promise<Set<string>> {
  try {
    const rows = await db.q<Row>(
      `SELECT access_key FROM store_page_access WHERE store_id = $1 AND enabled = FALSE`,
      [storeId],
    );
    return new Set(rows.map((row) => String(row.accessKey ?? row.access_key)));
  } catch (err) {
    if ((err as { code?: string }).code === "42P01") return new Set();
    throw err;
  }
}

/** A feature flag is blocked when the flag itself or its owning page is off. */
export function isFlagDisabled(disabled: ReadonlySet<string>, flag: PermissionFlag): boolean {
  return disabled.has(flag) || disabled.has(PAGE_KEY_BY_FLAG[flag]);
}

/** A module is blocked only when every page it backs is off. */
export function isModuleDisabled(disabled: ReadonlySet<string>, moduleKey: string): boolean {
  const pages = pagesForModule(moduleKey);
  if (pages.length === 0) return false;
  return pages.every((page) => disabled.has(page.key));
}

export interface AccessFeatureView {
  key: PermissionFlag;
  label: string;
  enabled: boolean;
}

export interface AccessPageView {
  key: string;
  label: string;
  moduleKey: PlanModuleKey | null;
  includedInPlan: boolean;
  enabled: boolean;
  features: AccessFeatureView[];
}

/** Builds the console/tenant view of a store's effective page access. */
export function buildAccessView(plan: PlanDefinition | null, disabled: ReadonlySet<string>): AccessPageView[] {
  return APP_PAGES.map((page) => {
    const includedInPlan = page.moduleKey == null ? true : hasPlanModule(plan, page.moduleKey);
    return {
      key: page.key,
      label: page.label,
      moduleKey: page.moduleKey,
      includedInPlan,
      enabled: includedInPlan && !disabled.has(page.key),
      features: page.features.map((feature) => ({
        key: feature.key,
        label: feature.label,
        enabled: !disabled.has(feature.key),
      })),
    };
  });
}
