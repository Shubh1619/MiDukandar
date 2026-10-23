import { qClient } from "../db/pool.js";
export const PLAN_STATUSES = ["ACTIVE", "ARCHIVED", "DRAFT"];
export const PLAN_ADS_TIERS = ["STANDARD", "MINIMAL"];
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
];
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
];
const dbIsUnavailable = (error) => {
    const code = error?.code;
    return code === "42P01" || code === "42703";
};
export function normalizeModuleKey(value) {
    const normalized = value.trim().toUpperCase();
    if (!PLAN_MODULE_KEYS.includes(normalized)) {
        throw new Error(`Unknown plan module: ${value}`);
    }
    return normalized;
}
function mapModule(row) {
    return {
        moduleKey: normalizeModuleKey(String(row.moduleKey ?? row.module_key)),
        enabled: Boolean(row.enabled),
        limitValue: row.limitValue == null && row.limit_value == null ? null : Number(row.limitValue ?? row.limit_value),
    };
}
function mapPlan(row, modules) {
    return {
        id: String(row.id),
        name: String(row.name),
        description: String(row.description ?? ""),
        priceMonthly: Number(row.priceMonthly ?? row.price_monthly ?? 0),
        priceYearly: Number(row.priceYearly ?? row.price_yearly ?? 0),
        trialDays: Number(row.trialDays ?? row.trial_days ?? 0),
        displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
        status: String(row.status ?? "DRAFT"),
        isPopular: Boolean(row.isPopular ?? row.is_popular),
        isDefault: Boolean(row.isDefault ?? row.is_default),
        adsEnabled: Boolean(row.adsEnabled ?? row.ads_enabled),
        adsTier: String(row.adsTier ?? row.ads_tier ?? "STANDARD"),
        supportTier: String(row.supportTier ?? row.support_tier ?? ""),
        customFeatures: Array.isArray(row.customFeatures ?? row.custom_features)
            ? (row.customFeatures ?? row.custom_features).map(String)
            : [],
        modules,
        activeBusinessCount: Number(row.activeBusinessCount ?? row.active_business_count ?? 0),
        moduleCount: Number(row.moduleCount ?? row.module_count ?? modules.filter((module) => module.enabled).length),
        createdAt: (row.createdAt ?? row.created_at),
        updatedAt: (row.updatedAt ?? row.updated_at),
    };
}
export async function getPlanModules(planId, db = qClient()) {
    const rows = await db.q(`SELECT module_key, enabled, limit_value FROM plan_modules WHERE plan_id = $1 ORDER BY module_key`, [planId]);
    return rows.map(mapModule);
}
export async function getPlanById(planId, db = qClient()) {
    const row = await db.qOne(`SELECT p.*,
            (SELECT COUNT(*) FROM stores s WHERE s.plan_id = p.id AND s.status = 'ACTIVE' AND s.plan_status <> 'CANCELED') AS active_business_count,
            (SELECT COUNT(*) FROM plan_modules pm WHERE pm.plan_id = p.id AND pm.enabled = TRUE) AS module_count
       FROM plans p WHERE p.id = $1`, [planId]);
    if (!row)
        return null;
    return mapPlan(row, await getPlanModules(planId, db));
}
export async function getPlanForBusiness(businessId, db = qClient()) {
    try {
        const row = await db.qOne(`SELECT p.id, s.plan_status, s.trial_ends_at
         FROM stores s
         LEFT JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
        WHERE s.id = $1`, [businessId]);
        if (!row?.id)
            return null;
        const plan = await getPlanById(String(row.id), db);
        if (!plan)
            return null;
        const rawStatus = String(row.planStatus ?? row.plan_status ?? "TRIAL");
        const trialEndsAt = (row.trialEndsAt ?? row.trial_ends_at);
        const trialEndsAtIso = trialEndsAt == null ? null : new Date(trialEndsAt).toISOString();
        const trialExpired = rawStatus === "TRIAL" &&
            (plan.priceMonthly > 0 || plan.priceYearly > 0) &&
            trialEndsAtIso != null &&
            new Date(trialEndsAtIso).getTime() <= Date.now();
        return {
            ...plan,
            subscriptionStatus: trialExpired ? "OVERDUE" : rawStatus,
            trialEndsAt: trialEndsAtIso,
        };
    }
    catch (error) {
        if (dbIsUnavailable(error))
            return null;
        throw error;
    }
}
export async function hasModuleAccess(businessId, moduleKey, db = qClient()) {
    const key = normalizeModuleKey(moduleKey);
    // Pages the superadmin can unlock beyond the plan (see lib/pages.ts). Imported
    // lazily: pages.ts imports back from this module, so a top-level import here
    // would create an ESM cycle where pagesForModule is undefined at call time.
    const { pagesForModule } = await import("./pages.js");
    const pageKeys = pagesForModule(key).map((page) => page.key);
    const run = async (withGrants) => {
        const row = await db.qOne(`SELECT pm.enabled AS included,
              (
                (COALESCE(p.price_monthly, 0) = 0 AND COALESCE(p.price_yearly, 0) = 0)
                OR (
                  s.plan_status IN ('TRIAL', 'ACTIVE')
                  AND (s.plan_status <> 'TRIAL' OR s.trial_ends_at IS NULL OR s.trial_ends_at > now())
                )
              ) AS billing_ok,
              ${withGrants
            ? `EXISTS (
                  SELECT 1 FROM store_page_access spa
                   WHERE spa.store_id = s.id
                     AND spa.enabled = TRUE
                     AND spa.access_key = ANY($3::text[])
                 )`
            : "FALSE"} AS granted
         FROM stores s
         JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
         LEFT JOIN plan_modules pm ON pm.plan_id = p.id AND pm.module_key = $2
        WHERE s.id = $1
          AND s.status = 'ACTIVE'
          AND p.status = 'ACTIVE'
        LIMIT 1`, withGrants ? [businessId, key, pageKeys] : [businessId, key]);
        if (!row)
            return false;
        const billingOk = (row.billing_ok ?? row.billingOk) === true;
        const included = (row.included ?? row.enabled) === true;
        const granted = row.granted === true;
        return billingOk && (included || granted);
    };
    try {
        return await run(true);
    }
    catch (error) {
        if (error.code === "42P01") {
            // store_page_access table absent (pre-migration): plan check only.
            try {
                return await run(false);
            }
            catch (retryError) {
                if (dbIsUnavailable(retryError))
                    return false;
                throw retryError;
            }
        }
        if (dbIsUnavailable(error))
            return false;
        throw error;
    }
}
export async function getModuleLimit(businessId, moduleKey, db = qClient()) {
    const key = normalizeModuleKey(moduleKey);
    try {
        const row = await db.qOne(`SELECT pm.limit_value
         FROM stores s
         JOIN plans p ON p.id = s.plan_id OR (s.plan_id IS NULL AND p.is_default = TRUE)
         JOIN plan_modules pm ON pm.plan_id = p.id AND pm.module_key = $2
        WHERE s.id = $1
        LIMIT 1`, [businessId, key]);
        return row?.limitValue == null && row?.limit_value == null ? null : Number(row.limitValue ?? row.limit_value);
    }
    catch (error) {
        if (dbIsUnavailable(error))
            return null;
        throw error;
    }
}
export function getModule(plan, moduleKey) {
    const key = moduleKey.trim().toUpperCase();
    return plan.modules.find((module) => module.moduleKey === key);
}
export function hasPlanModule(plan, moduleKey) {
    return plan ? getModule(plan, moduleKey)?.enabled === true : false;
}
