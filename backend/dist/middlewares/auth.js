import { qOne } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { hasModuleAccess } from "../lib/plans.js";
import { logger } from "../lib/logger.js";
/**
 * Verifies the Bearer access token and attaches `request.auth`.
 * Runs on every protected route — this is the front door of the API.
 */
export async function authenticate(request, reply) {
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
        const payload = await request.jwtVerify();
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
    }
    catch (err) {
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
    void reply;
}
export function getAuth(request) {
    const auth = request.auth;
    if (!auth)
        throw ApiError.unauthorized();
    return auth;
}
/** Requires the user to have a store bound to their account. */
export function requireStore(request) {
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
export function requireRole(...roles) {
    return async (request) => {
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
export function checkPermission(module, action = "manage") {
    return async (request) => {
        const user = getAuth(request);
        if (user.role === "OWNER")
            return;
        const storeId = requireStore(request);
        const flag = `can_${action}_${module}`;
        const row = await qOne(`SELECT permissions FROM roles_permissions WHERE store_id = $1 AND role = $2`, [storeId, user.role === "STOCK_MANAGER" ? "STAFF" : user.role]);
        const permissions = (row?.permissions ?? {});
        if (permissions[flag] !== true) {
            throw ApiError.forbidden("You do not have permission to perform this action.");
        }
    };
}
export function requireModuleAccess(moduleKey) {
    return async (request) => {
        const storeId = requireStore(request);
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
