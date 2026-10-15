import { ApiError } from "../lib/api-error.js";
import { config } from "../config.js";
import { verifySuperAdminToken } from "../lib/superadmin-jwt.js";
export function getSuperadmin(request) {
    const sa = request.superadmin;
    if (!sa)
        throw ApiError.unauthorized();
    return sa;
}
/**
 * Platform-level auth guard: verifies the credential with the DEDICATED
 * superadmin secret (never the tenant JWT secret) and requires the bearer to
 * carry role SUPERADMIN. Tenant Owner tokens therefore never pass here, and
 * superadmin tokens never pass the tenant `authenticate` guard.
 *
 * Two transports are accepted, in priority order:
 *   1. `Authorization: Bearer <token>` — retained for non-browser clients.
 *   2. The httpOnly `mz_sa` cookie — the only credential the web console ever
 *      holds, so the token is never readable from JavaScript or localStorage.
 *
 * The cookie carries the *same* signed superadmin token and the *same* `exp`
 * as before, so session length and expiry behaviour are unchanged. Because the
 * tenant API deliberately stays Bearer-only, this cookie adds no CSRF exposure
 * to `/api/*` tenant routes: they never read it.
 */
export async function requireSuperAdmin(request, reply) {
    const header = String(request.headers.authorization ?? "");
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
    const cookie = request.cookies?.[config.superAdminCookieName] ?? "";
    const token = bearer || cookie;
    if (!token)
        throw ApiError.unauthorized("Superadmin token required.");
    const payload = verifySuperAdminToken(token);
    if (payload.role !== "SUPERADMIN") {
        throw ApiError.forbidden("Token is not authorized for superadmin access.");
    }
    request.superadmin = {
        id: String(payload.sub ?? ""),
        email: String(payload.email ?? ""),
        name: String(payload.name ?? ""),
    };
    void reply;
}
