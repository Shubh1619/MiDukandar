import { qExec } from "../db/pool.js";
/** Best-effort client IP honoring X-Forwarded-For when behind a proxy. */
export function clientIp(request) {
    const fwd = request.headers["x-forwarded-for"];
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return String(raw?.toString().trim().split(",")[0] ?? request.ip ?? "").slice(0, 64);
}
/**
 * Writes one row to superadmin_audit_logs for a privileged action. Every
 * superadmin route that reads or modifies tenant/platform data must call this.
 */
export async function logSuperadminAction(request, action, opts = {}) {
    const sa = request.superadmin;
    await qExec(`INSERT INTO superadmin_audit_logs (superadmin_id, action, target_tenant_id, target_user_id, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`, [
        sa?.id ?? null,
        action,
        opts.targetTenantId ?? null,
        opts.targetUserId ?? null,
        opts.reason ?? null,
        clientIp(request),
    ]);
}
