/**
 * Role permission matrix shared by the /api/roles routes (read/write) and the
 * server-side authorization guards in middlewares/auth.ts. Kept in lib/ to
 * avoid a circular import between those two modules.
 */

export const PERMISSION_FLAGS = [
  "can_manage_invoices",
  "can_manage_products",
  "can_manage_customers",
  "can_manage_udhaari",
  "can_manage_suppliers",
  "can_manage_expenses",
  "can_view_reports",
  "can_manage_settings",
  "can_manage_users",
] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

export type TenantRole = "OWNER" | "MANAGER" | "CASHIER" | "STAFF";

export const DEFAULT_PERMISSIONS: Record<TenantRole, Record<PermissionFlag, boolean>> = {
  OWNER: {
    can_manage_invoices: true,
    can_manage_products: true,
    can_manage_customers: true,
    can_manage_udhaari: true,
    can_manage_suppliers: true,
    can_manage_expenses: true,
    can_view_reports: true,
    can_manage_settings: true,
    can_manage_users: true,
  },
  MANAGER: {
    can_manage_invoices: true,
    can_manage_products: true,
    can_manage_customers: true,
    can_manage_udhaari: true,
    can_manage_suppliers: true,
    can_manage_expenses: true,
    can_view_reports: true,
    can_manage_settings: false,
    can_manage_users: false,
  },
  CASHIER: {
    can_manage_invoices: true,
    can_manage_products: false,
    can_manage_customers: true,
    can_manage_udhaari: true,
    can_manage_suppliers: false,
    can_manage_expenses: false,
    can_view_reports: false,
    can_manage_settings: false,
    can_manage_users: false,
  },
  STAFF: {
    can_manage_invoices: false,
    can_manage_products: true,
    can_manage_customers: false,
    can_manage_udhaari: false,
    can_manage_suppliers: false,
    can_manage_expenses: false,
    can_view_reports: false,
    can_manage_settings: false,
    can_manage_users: false,
  },
};

/** Map any stored role value to its permission-matrix key (STOCK_MANAGER → STAFF). */
export function permissionRoleKey(role: string | null | undefined): TenantRole {
  if (role === "STOCK_MANAGER") return "STAFF";
  if (role === "OWNER" || role === "MANAGER" || role === "CASHIER" || role === "STAFF") return role;
  return "STAFF";
}

export function defaultPermissionsFor(role: string | null | undefined): Record<PermissionFlag, boolean> {
  return { ...DEFAULT_PERMISSIONS[permissionRoleKey(role)] };
}
