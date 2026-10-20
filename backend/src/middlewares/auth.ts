import type { FastifyRequest, FastifyReply } from "fastify";
import { qOne, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { hasModuleAccess } from "../lib/plans.js";
import { getDisabledAccessKeys, isFlagDisabled, isModuleDisabled } from "../lib/pages.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { logger } from "../lib/logger.js";
import { defaultPermissionsFor, permissionRoleKey, type PermissionFlag } from "../lib/permissions.js";
import type { Role } from "./auth.types.js";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** "businessId" = store scope. Kept as a first-class claim for future multi-store support. */
  businessId: string | null;
  storeId: string | null;
  name: string | null;
}

export type AuthenticatedRequest = FastifyRequest;

/**
 * Verifies the Bearer access token and attaches `request.auth`.
 * Runs on every protected route — this is the front door of the API.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const raw = request.headers.authorization;
  const base = { path: request.url, method: request.method, ip: request.ip };

  if (!raw || raw.trim() === "") {
    logger.warn("auth:401", { ...base, reason: "no_token", hasAuthHeader: false });
    throw ApiError.unauthorized("Invalid or expired access token.");
  }

  const [scheme, token, extra] = raw.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || typeof extra !== "undefined") {
    logger.warn("auth:401", { ...base, reason: "malformed_header", shape: raw.slice(0, 24) });
    throw ApiError.unauthorized("Invalid or expired access token.");
  }

  try {
    const payload = await request.jwtVerify<{
      sub: string; email: string; role: Role; businessId: string | null;
      storeId: string | null; name: string | null;
    }>();
    if (payload.role === "SUPERADMIN") {
      throw ApiError.forbidden("Superadmin credentials cannot access tenant APIs.");
    }
    request.auth = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      businessId: payload.businessId ?? null,
      storeId: payload.storeId ?? null,
      name: payload.name ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason = /expired|not active/i.test(msg)
      ? "expired"
      : /invalid signature|invalid token|signature/i.test(msg)
        ? "invalid_signature"
        : /malformed/gi.test(msg)
          ? "malformed"
          : "verify_failed";
    logger.warn("auth:401", {
      ...base,
      reason,
      tokenPrefix: token.slice(0, 4),
      tokenSuffix: token.slice(-4),
      tokenLength: token.length,
      verifyError: msg.slice(0, 160),
    });
    throw ApiError.unauthorized("Invalid or expired access token.");
  }

  // Suspended / non-active businesses must not keep API access. The access
  // token is otherwise valid, so check the store's live status on every
  // request (a single indexed primary-key lookup). Platform superadmins are
  // unaffected because they never reach this middleware — their routes use
  // the separate mz_sa cookie guard.
  if (request.auth?.storeId) {
    // Maintenance mode (set from the superadmin console) takes the whole tenant
    // API offline while leaving superadmin routes reachable so it can be turned
    // back off. Settings are cached for a few seconds, so this is not a query
    // per request.
    const settings = await getPlatformSettings();
    if (settings.maintenance_mode) {
      logger.warn("authz: denied", { ...base, userId: request.auth.id, reason: "maintenance_mode" });
      throw ApiError.serviceUnavailableCode("MiDukandar is under maintenance. Please try again shortly.", "MAINTENANCE_MODE");
    }

    const store = await qOne<Row>(`SELECT status FROM stores WHERE id = $1`, [request.auth.storeId]);
    const status = (store?.status as string | undefined) ?? null;
    if (status && status !== "ACTIVE") {
      logger.warn("authz: denied", {
        ...base,
        userId: request.auth.id,
        storeId: request.auth.storeId,
        status,
        reason: "store_not_active",
      });
      throw ApiError.forbidden("This business account is suspended. Contact support for help restoring access.");
    }
  }
  void reply;
}

export function getAuth(request: FastifyRequest): AuthUser {
  const auth = request.auth;
  if (!auth) throw ApiError.unauthorized();
  return auth;
}

/** Requires the user to have a store bound to their account. */
export function requireStore(request: FastifyRequest): string {
  const user = getAuth(request);
  if (!user.storeId) {
    throw ApiError.forbidden("No store associated with this account. Complete business setup first.");
  }
  return user.storeId;
}

/**
 * Role-based access control: returns a preHandler that only allows the given
 * roles. Owner always passes.
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest) => {
    const user = getAuth(request);
    if (user.role !== "OWNER" && !roles.includes(user.role)) {
      logger.warn("authz: denied", {
        path: request.url,
        userId: user.id,
        role: user.role,
        requiredRoles: roles,
        reason: "blocked_by_role_check",
      });
      throw ApiError.forbidden("You do not have permission to perform this action.");
    }
  };
}

/**
 * Permission-flag guard. Owner always passes; every other role's configured
 * flag is read from `roles_permissions` for the store. When no row exists the
 * role's documented default applies (never a permissive fallback), so a
 * missing row cannot silently grant access.
 */
export function requirePermission(flag: PermissionFlag) {
  return async (request: FastifyRequest) => {
    const user = getAuth(request);
    if (user.storeId) {
      const disabled = await getDisabledAccessKeys(user.storeId);
      if (isFlagDisabled(disabled, flag)) {
        logger.warn("authz: denied", {
          path: request.url,
          userId: user.id,
          role: user.role,
          flag,
          reason: "blocked_by_store_access_override",
        });
        throw ApiError.forbidden("This feature has been disabled for this business.");
      }
    }
    if (user.role === "OWNER") return;
    const storeId = requireStore(request);
    const roleKey = permissionRoleKey(user.role);
    const row = await qOne<Row>(
      `SELECT permissions FROM roles_permissions WHERE store_id = $1 AND role = $2`,
      [storeId, roleKey],
    );
    const stored = (row?.permissions ?? {}) as Record<string, unknown>;
    const allowed = typeof stored[flag] === "boolean" ? stored[flag] : defaultPermissionsFor(roleKey)[flag];
    if (allowed !== true) {
      logger.warn("authz: denied", {
        path: request.url,
        userId: user.id,
        role: user.role,
        flag,
        reason: "blocked_by_permission_flag",
      });
      throw ApiError.forbidden("You do not have permission to perform this action.");
    }
  };
}

export function checkPermission(module: string, action = "manage") {
  return requirePermission(`can_${action}_${module}` as PermissionFlag);
}

export function requireModuleAccess(moduleKey: string) {
  return async (request: FastifyRequest) => {
    const storeId = requireStore(request);
    const disabled = await getDisabledAccessKeys(storeId);
    if (isModuleDisabled(disabled, moduleKey)) {
      const user = getAuth(request);
      logger.warn("authz: denied", {
        path: request.url,
        userId: user.id,
        role: user.role,
        moduleKey,
        reason: "blocked_by_store_access_override",
      });
      throw ApiError.forbidden("This module has been disabled for this business.");
    }
    if (!(await hasModuleAccess(storeId, moduleKey))) {
      const user = getAuth(request);
      logger.warn("authz: denied", {
        path: request.url,
        userId: user.id,
        role: user.role,
        moduleKey,
        reason: "blocked_by_plan_module_check",
      });
      throw ApiError.forbidden("Upgrade your plan to unlock this module.");
    }
  };
}
