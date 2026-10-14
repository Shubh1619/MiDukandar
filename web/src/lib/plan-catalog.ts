export type PlanStatus = "ACTIVE" | "ARCHIVED" | "DRAFT";
export type PlanAdsTier = "STANDARD" | "MINIMAL";
export type PlanModuleKey =
  | "DASHBOARD"
  | "BILLING"
  | "PRODUCTS"
  | "INVENTORY"
  | "SALES_INVOICES"
  | "CUSTOMERS_UDHAARI"
  | "SUPPLIERS"
  | "PURCHASES"
  | "EXPENSES"
  | "GST_REPORTS"
  | "USERS_ROLES"
  | "MULTI_STORE"
  | "ADVANCED_ANALYTICS"
  | "BARCODE_HARDWARE"
  | "WHATSAPP_SHARING"
  | "API_ACCESS";

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

export type PlanModuleGroup = {
  key: string;
  label: string;
  modules: PlanModuleKey[];
};

export const PLAN_MODULE_GROUPS: PlanModuleGroup[] = [
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

export const PLAN_MODULE_LABELS: Record<PlanModuleKey, string> = {
  DASHBOARD: "Dashboard",
  BILLING: "Billing / POS",
  PRODUCTS: "Products",
  INVENTORY: "Inventory",
  SALES_INVOICES: "Sales & Invoices",
  CUSTOMERS_UDHAARI: "Customers & Udhaari",
  SUPPLIERS: "Suppliers",
  PURCHASES: "Purchases",
  EXPENSES: "Expenses",
  GST_REPORTS: "GST & Reports",
  USERS_ROLES: "Users & Roles",
  MULTI_STORE: "Multi-Store",
  ADVANCED_ANALYTICS: "Advanced Analytics",
  BARCODE_HARDWARE: "Barcode / Hardware Integration",
  WHATSAPP_SHARING: "WhatsApp Sharing",
  API_ACCESS: "API Access",
};

export const PLAN_LIMIT_LABELS: Partial<Record<PlanModuleKey, string>> = {
  PRODUCTS: "Max products",
  USERS_ROLES: "Max staff users",
  MULTI_STORE: "Max stores",
};

export const PLAN_COMPARISON_ROWS: Array<{ label: string; moduleKey?: PlanModuleKey; ads?: boolean }> = [
  { label: "Dashboard", moduleKey: "DASHBOARD" },
  { label: "Billing / POS", moduleKey: "BILLING" },
  { label: "Products", moduleKey: "PRODUCTS" },
  { label: "Inventory", moduleKey: "INVENTORY" },
  { label: "Sales & Invoices", moduleKey: "SALES_INVOICES" },
  { label: "Customers & Udhaari", moduleKey: "CUSTOMERS_UDHAARI" },
  { label: "Suppliers", moduleKey: "SUPPLIERS" },
  { label: "Purchases", moduleKey: "PURCHASES" },
  { label: "Expenses", moduleKey: "EXPENSES" },
  { label: "GST & Reports", moduleKey: "GST_REPORTS" },
  { label: "Users & Roles", moduleKey: "USERS_ROLES" },
  { label: "Multi-Store", moduleKey: "MULTI_STORE" },
  { label: "Advanced Analytics", moduleKey: "ADVANCED_ANALYTICS" },
  { label: "Barcode / Hardware", moduleKey: "BARCODE_HARDWARE" },
  { label: "WhatsApp Sharing", moduleKey: "WHATSAPP_SHARING" },
  { label: "API Access", moduleKey: "API_ACCESS" },
  { label: "Ad-free experience", ads: true },
];

export function getPlanModule(plan: PlanDefinition | null | undefined, moduleKey: PlanModuleKey) {
  return plan?.modules.find((module) => module.moduleKey === moduleKey);
}

export function planHasModule(plan: PlanDefinition | null | undefined, moduleKey: PlanModuleKey) {
  return getPlanModule(plan, moduleKey)?.enabled === true;
}

export function formatPlanPrice(value: number) {
  return `₹${Number(value.toFixed(2)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function moduleFeatureLabel(module: PlanModule) {
  const base = PLAN_MODULE_LABELS[module.moduleKey];
  if (!PLAN_LIMIT_LABELS[module.moduleKey]) return base;
  if (module.limitValue === 0) {
    if (module.moduleKey === "PRODUCTS") return "Unlimited products";
    if (module.moduleKey === "USERS_ROLES") return "Unlimited staff users";
    return "Unlimited stores";
  }
  if (module.limitValue == null) return base;
  return `Up to ${module.limitValue} ${module.moduleKey === "PRODUCTS" ? "products" : module.moduleKey === "USERS_ROLES" ? "staff users" : "stores"}`;
}

export function planFeatureList(plan: PlanDefinition) {
  const features = plan.modules.filter((module) => module.enabled).map(moduleFeatureLabel);
  if (plan.trialDays > 0) features.unshift(`${plan.trialDays}-day free trial`);
  features.push(plan.adsEnabled ? "Ads shown" : "Ad-free experience");
  if (plan.supportTier) features.push(`${plan.supportTier} support`);
  features.push(...plan.customFeatures);
  return Array.from(new Set(features));
}
