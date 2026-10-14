import { qClient, type DbClient, type Row } from "../db/pool.js";

export const PLAN_STATUSES = ["ACTIVE", "ARCHIVED", "DRAFT"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_ADS_TIERS = ["STANDARD", "MINIMAL"] as const;
export type PlanAdsTier = (typeof PLAN_ADS_TIERS)[number];

export const PLAN_MODULE_KEYS = [
  "DASHBOARD",
  "BILLING",
  "PRODUCTS",
  "INVENTORY",
  "SALES_INVOICES",
  "CUSTOMERS_UDHAARI",
  "SUPPLIERS",
  "PURCHASES",
  "EXPENSES",
  "GST_REPORTS",
  "USERS_ROLES",
  "MULTI_STORE",
  "ADVANCED_ANALYTICS",
  "BARCODE_HARDWARE",
  "WHATSAPP_SHARING",
  "API_ACCESS",
] as const;

export type PlanModuleKey = (typeof PLAN_MODULE_KEYS)[number];

export const PLAN_MODULE_GROUPS = [
  { key: "CORE", label: "Core", modules: ["DASHBOARD", "BILLING", "PRODUCTS", "INVENTORY"] },
  { key: "SALES", label: "Sales", modules: ["SALES_INVOICES", "CUSTOMERS_UDHAARI", "SUPPLIERS", "PURCHASES"] },
  { key: "FINANCE", label: "Finance", modules: ["EXPENSES", "GST_REPORTS"] },
  { key: "TEAM", label: "Team", modules: ["USERS_ROLES"] },
  {
    key: "ADVANCED",
    label: "Advanced",
    modules: ["MULTI_STORE", "ADVANCED_ANALYTICS", "BARCODE_HARDWARE", "WHATSAPP_SHARING", "API_ACCESS"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  modules: readonly PlanModuleKey[];
}>;

export type PlanModuleInput = {
  moduleKey: string;
  enabled: boolean;
  limitValue?: number | null;
};

export type PlanModule = {
  moduleKey: PlanModuleKey;
  enabled: boolean;
  limitValue: number | null;
};

export type PlanDefinition = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  displayOrder: number;
  status: PlanStatus;
  isPopular: boolean;
  isDefault: boolean;
  adsEnabled: boolean;
  adsTier: PlanAdsTier;
  supportTier: string;
  customFeatures: string[];
  modules: PlanModule[];
  activeBusinessCount?: number;
  moduleCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
};

const dbIsUnavailable = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  return code === "42P01" || code === "42703";
};

export function normalizeModuleKey(value: string): PlanModuleKey {
  const normalized = value.trim().toUpperCase();
  if (!PLAN_MODULE_KEYS.includes(normalized as PlanModuleKey)) {
    throw new Error(`Unknown plan module: ${value}`);
  }
  return normalized as PlanModuleKey;
}

function mapModule(row: Row): PlanModule {
  return {
    moduleKey: normalizeModuleKey(String(row.moduleKey ?? row.module_key)),
    enabled: Boolean(row.enabled),
    limitValue: row.limitValue == null && row.limit_value == null ? null : Number(row.limitValue ?? row.limit_value),
  };
}

function mapPlan(row: Row, modules: PlanModule[]): PlanDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    priceMonthly: Number(row.priceMonthly ?? row.price_monthly ?? 0),
    priceYearly: Number(row.priceYearly ?? row.price_yearly ?? 0),
    trialDays: Number(row.trialDays ?? row.trial_days ?? 0),
    displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
    status: String(row.status ?? "DRAFT") as PlanStatus,
    isPopular: Boolean(row.isPopular ?? row.is_popular),
    isDefault: Boolean(row.isDefault ?? row.is_default),
    adsEnabled: Boolean(row.adsEnabled ?? row.ads_enabled),
    adsTier: String(row.adsTier ?? row.ads_tier ?? "STANDARD") as PlanAdsTier,
    supportTier: String(row.supportTier ?? row.support_tier ?? ""),
    customFeatures: Array.isArray(row.customFeatures ?? row.custom_features)
      ? ((row.customFeatures ?? row.custom_features) as unknown[]).map(String)
      : [],
    modules,
    activeBusinessCount: Number(row.activeBusinessCount ?? row.active_business_count ?? 0),
    moduleCount: Number(row.moduleCount ?? row.module_count ?? modules.filter((module) => module.enabled).length),
    createdAt: (row.createdAt ?? row.created_at) as string | null | undefined,
    updatedAt: (row.updatedAt ?? row.updated_at) as string | null | undefined,
  };
}

export async function getPlanModules(planId: string, db: DbClient = qClient()): Promise<PlanModule[]> {
  const rows = await db.q<Row>(
    `SELECT module_key, enabled, limit_value FROM plan_modules WHERE plan_id = $1 ORDER BY module_key`,
    [planId],
  );
  return rows.map(mapModule);
}

export async function getPlanById(planId: string, db: DbClient = qClient()): Promise<PlanDefinition | null> {
  const row = await db.qOne<Row>(
    `SELECT p.*,
            (SELECT COUNT(*) FROM stores s WHERE s.plan_id = p.id AND s.status = 'ACTIVE' AND s.plan_status <> 'CANCELED') AS active_business_count,
            (SELECT COUNT(*) FROM plan_modules pm WHERE pm.plan_id = p.id AND pm.enabled = TRUE) AS module_count
       FROM plans p WHERE p.id = $1`,
    [planId],
  );
  if (!row) return null;
  return mapPlan(row, await getPlanModules(planId, db));
}

export async function getPlanForBusiness(businessId: string, db: DbClient = qClient()): Promise<PlanDefinition | null> {
  try {
    const row = await db.qOne<Row>(
      `SELECT p.id, s.plan_status, s.trial_ends_at
         FROM stores s
         LEFT JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
        WHERE s.id = $1`,
      [businessId],
    );
    if (!row?.id) return null;
    const plan = await getPlanById(String(row.id), db);
    if (!plan) return null;
    const rawStatus = String(row.planStatus ?? row.plan_status ?? "TRIAL");
    const trialEndsAt = (row.trialEndsAt ?? row.trial_ends_at) as string | Date | null | undefined;
    const trialEndsAtIso = trialEndsAt == null ? null : new Date(trialEndsAt).toISOString();
    const trialExpired =
      rawStatus === "TRIAL" &&
      (plan.priceMonthly > 0 || plan.priceYearly > 0) &&
      trialEndsAtIso != null &&
      new Date(trialEndsAtIso).getTime() <= Date.now();
    return {
      ...plan,
      subscriptionStatus: trialExpired ? "OVERDUE" : rawStatus,
      trialEndsAt: trialEndsAtIso,
    };
  } catch (error) {
    if (dbIsUnavailable(error)) return null;
    throw error;
  }
}

export async function hasModuleAccess(
  businessId: string,
  moduleKey: string,
  db: DbClient = qClient(),
): Promise<boolean> {
  const key = normalizeModuleKey(moduleKey);
  try {
    const row = await db.qOne<Row>(
      `SELECT pm.enabled
         FROM stores s
         JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
         JOIN plan_modules pm ON pm.plan_id = p.id AND pm.module_key = $2
        WHERE s.id = $1
          AND s.status = 'ACTIVE'
          AND p.status = 'ACTIVE'
          AND (
            (COALESCE(p.price_monthly, 0) = 0 AND COALESCE(p.price_yearly, 0) = 0)
            OR (
              s.plan_status IN ('TRIAL', 'ACTIVE')
              AND (s.plan_status <> 'TRIAL' OR s.trial_ends_at IS NULL OR s.trial_ends_at > now())
            )
          )
        LIMIT 1`,
      [businessId, key],
    );
    return row?.enabled === true;
  } catch (error) {
    if (dbIsUnavailable(error)) return false;
    throw error;
  }
}

export async function getModuleLimit(
  businessId: string,
  moduleKey: string,
  db: DbClient = qClient(),
): Promise<number | null> {
  const key = normalizeModuleKey(moduleKey);
  try {
    const row = await db.qOne<Row>(
      `SELECT pm.limit_value
         FROM stores s
         JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
         JOIN plan_modules pm ON pm.plan_id = p.id AND pm.module_key = $2
        WHERE s.id = $1
        LIMIT 1`,
      [businessId, key],
    );
    return row?.limitValue == null && row?.limit_value == null ? null : Number(row.limitValue ?? row.limit_value);
  } catch (error) {
    if (dbIsUnavailable(error)) return null;
    throw error;
  }
}

export function getModule(plan: PlanDefinition, moduleKey: string): PlanModule | undefined {
  const key = moduleKey.trim().toUpperCase();
  return plan.modules.find((module) => module.moduleKey === key);
}

export function hasPlanModule(plan: PlanDefinition | null | undefined, moduleKey: string): boolean {
  return plan ? getModule(plan, moduleKey)?.enabled === true : false;
}
