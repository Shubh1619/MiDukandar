import { z } from "zod";
import { q, qOne, qExec } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { authenticate, requireStore, requireRole } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
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
];
const DEFAULT_PERMISSIONS = {
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
export const MANAGED_ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF"];
function isManagedRole(role) {
    return MANAGED_ROLES.includes(role);
}
export function defaultPermissionsFor(role) {
    return isManagedRole(role) ? { ...DEFAULT_PERMISSIONS[role] } : { ...DEFAULT_PERMISSIONS.STAFF };
}
function normalizePermissions(role, input) {
    const base = defaultPermissionsFor(role);
    if (!input || typeof input !== "object")
        return base;
    const obj = input;
    for (const flag of PERMISSION_FLAGS) {
        if (typeof obj[flag] === "boolean")
            base[flag] = obj[flag];
    }
    if (role === "OWNER") {
        for (const flag of PERMISSION_FLAGS)
            base[flag] = true;
    }
    return base;
}
export async function ensureDefaultRolePermissions(storeId) {
    for (const role of MANAGED_ROLES) {
        await qExec(`INSERT INTO roles_permissions (store_id, role, permissions)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (store_id, role) DO NOTHING`, [storeId, role, JSON.stringify(DEFAULT_PERMISSIONS[role])]);
    }
}
export async function roleRoutes(app) {
    app.get("/", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        await ensureDefaultRolePermissions(storeId);
        const rows = await q(`SELECT role, permissions, updated_at
       FROM roles_permissions
       WHERE store_id = $1
       ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 WHEN 'CASHIER' THEN 3 ELSE 4 END`, [storeId]);
        return {
            roles: rows.map((row) => ({
                role: row.role,
                permissions: normalizePermissions(String(row.role), row.permissions),
                locked: row.role === "OWNER",
                updatedAt: row.updated_at,
            })),
            flags: PERMISSION_FLAGS,
        };
    });
    app.patch("/:role", { preHandler: [authenticate, requireRole(ROLES.OWNER)] }, async (request) => {
        const storeId = requireStore(request);
        const { role } = request.params;
        const normalizedRole = role.toUpperCase();
        if (normalizedRole === "OWNER")
            throw ApiError.forbidden("Owner permissions cannot be edited.");
        if (!["MANAGER", "CASHIER", "STAFF"].includes(normalizedRole)) {
            throw ApiError.badRequest("Unknown role.");
        }
        const body = parse(z.object({ permissions: z.record(z.boolean()) }), request.body);
        const permissions = normalizePermissions(normalizedRole, body.permissions);
        const saved = await qOne(`INSERT INTO roles_permissions (store_id, role, permissions)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (store_id, role)
         DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now()
         RETURNING role, permissions, updated_at`, [storeId, normalizedRole, JSON.stringify(permissions)]);
        return { role: saved };
    });
}
