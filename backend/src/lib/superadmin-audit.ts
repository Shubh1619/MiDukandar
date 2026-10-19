import type { FastifyRequest } from "fastify";
import type { SuperadminAuth } from "../middlewares/superadmin.js";
import { qExec } from "../db/pool.js";

/**
 * Client IP recorded on an audit row.
 *
 * `request.ip` is resolved by Fastify's trust filter (see app.ts), which only
 * honours X-Forwarded-For through a co-located loopback proxy, so the value
 * comes from the TCP peer otherwise. Reading the raw header instead took its
 * FIRST entry — fully client-supplied, so any caller could prepend its own
 * address and have the audit trail attribute the action to it.
 */
export function clientIp(request: FastifyRequest): string {
  return String(request.ip ?? "").slice(0, 64);
}

export interface AuditLogOptions {
  targetTenantId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
}

/**
 * Writes one row to superadmin_audit_logs for a privileged action. Every
 * superadmin route that reads or modifies tenant/platform data must call this.
 */
export async function logSuperadminAction(
  request: FastifyRequest,
  action: string,
  opts: AuditLogOptions = {},
): Promise<void> {
  const sa = request.superadmin as SuperadminAuth | undefined;
  await qExec(
    `INSERT INTO superadmin_audit_logs (superadmin_id, action, target_tenant_id, target_user_id, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sa?.id ?? null,
      action,
      opts.targetTenantId ?? null,
      opts.targetUserId ?? null,
      opts.reason ?? null,
      clientIp(request),
    ],
  );
}