import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, qExec, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { authenticate, requireStore, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES, type Role } from "../middlewares/auth.types.js";
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_FLAGS,
  defaultPermissionsFor,
  type PermissionFlag,
} from "../lib/permissions.js";

export { PERMISSION_FLAGS, DEFAULT_PERMISSIONS, defaultPermissionsFor };
export type { PermissionFlag };

export const MANAGED_ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF"] as const;

function normalizePermissions(role: string, input: unknown): Record<PermissionFlag, boolean> {
  const base = defaultPermissionsFor(role);
  if (!input || typeof input !== "object") return base;
  const obj = input as Record<string, unknown>;
  for (const flag of PERMISSION_FLAGS) {
    if (typeof obj[flag] === "boolean") base[flag] = obj[flag];
  }
  if (role === "OWNER") {
    for (const flag of PERMISSION_FLAGS) base[flag] = true;
  }
  return base;
}

export async function ensureDefaultRolePermissions(storeId: string) {
  for (const role of MANAGED_ROLES) {
    await qExec(
      `INSERT INTO roles_permissions (store_id, role, permissions)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (store_id, role) DO NOTHING`,
      [storeId, role, JSON.stringify(DEFAULT_PERMISSIONS[role])],
    );
  }
}

export async function roleRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    await ensureDefaultRolePermissions(storeId);
    const rows = await q<Row>(
      `SELECT role, permissions, updated_at
       FROM roles_permissions
       WHERE store_id = $1
       ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 WHEN 'CASHIER' THEN 3 ELSE 4 END`,
      [storeId],
    );
    return {
      roles: rows.map((row) => ({
        role: row.role as Role,
        permissions: normalizePermissions(String(row.role), row.permissions),
        locked: row.role === "OWNER",
        updatedAt: row.updated_at,
      })),
      flags: PERMISSION_FLAGS,
    };
  });

  app.patch(
    "/:role",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { role } = request.params as { role: string };
      const normalizedRole = role.toUpperCase();
      if (normalizedRole === "OWNER") throw ApiError.forbidden("Owner permissions cannot be edited.");
      if (!["MANAGER", "CASHIER", "STAFF"].includes(normalizedRole)) {
        throw ApiError.badRequest("Unknown role.");
      }
      const body = parse(z.object({ permissions: z.record(z.boolean()) }), request.body);
      const permissions = normalizePermissions(normalizedRole, body.permissions);
      const saved = await qOne<Row>(
        `INSERT INTO roles_permissions (store_id, role, permissions)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (store_id, role)
         DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now()
         RETURNING role, permissions, updated_at`,
        [storeId, normalizedRole, JSON.stringify(permissions)],
      );
      return { role: saved };
    },
  );
}
