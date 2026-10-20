/**
 * Platform superadmin: per-shop page & feature access.
 *
 * A shop's effective access is plan modules + role permissions minus the keys
 * a superadmin has explicitly turned off, PLUS any key the superadmin has
 * explicitly granted: a grant (`enabled = TRUE` row) unlocks a page even when
 * the tenant's plan does not include it. The superadmin can therefore enable
 * any page for any plan; only the superadmin can create these overrides.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { qOne, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { logSuperadminAction } from "../lib/superadmin-audit.js";
import { getPlanForBusiness } from "../lib/plans.js";
import {
  accessKeyIncludedInPlan,
  buildAccessView,
  getDisabledAccessKeys,
  getGrantedAccessKeys,
  isKnownAccessKey,
} from "../lib/pages.js";
import { requireSuperAdmin } from "../middlewares/superadmin.js";

const tenantIdParams = z.object({ id: z.string().uuid() });

const accessBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
  access: z.record(z.boolean()),
});

async function assertStore(id: string): Promise<void> {
  const store = await qOne<Row>(`SELECT id FROM stores WHERE id = $1`, [id]);
  if (!store) throw ApiError.notFound("Tenant not found.");
}

export async function superadminAccessRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSuperAdmin);

  app.get("/tenants/:id/access", async (request) => {
    const { id } = parse(tenantIdParams, request.params);
    await assertStore(id);
    const plan = await getPlanForBusiness(id);
    const disabled = await getDisabledAccessKeys(id);
    const granted = await getGrantedAccessKeys(id);

    await logSuperadminAction(request, "TENANT_ACCESS_VIEW", { targetTenantId: id });

    return { planName: plan?.name ?? null, pages: buildAccessView(plan, disabled, granted) };
  });

  app.put("/tenants/:id/access", async (request) => {
    const { id } = parse(tenantIdParams, request.params);
    const body = parse(accessBodySchema, request.body);
    await assertStore(id);

    const entries = Object.entries(body.access);
    const unknown = entries.map(([key]) => key).filter((key) => !isKnownAccessKey(key));
    if (unknown.length > 0) {
      throw ApiError.badRequest(`Unknown access key(s): ${unknown.join(", ")}`);
    }

    const plan = await getPlanForBusiness(id);

    await withTx(async (db) => {
      for (const [key, enabled] of entries) {
        if (enabled) {
          if (accessKeyIncludedInPlan(plan, key)) {
            await db.query(`DELETE FROM store_page_access WHERE store_id = $1 AND access_key = $2`, [id, key]);
          } else {
            // Granted beyond the plan: persist an explicit unlock for this shop.
            await db.query(
              `INSERT INTO store_page_access (store_id, access_key, enabled)
               VALUES ($1, $2, TRUE)
               ON CONFLICT (store_id, access_key) DO UPDATE SET enabled = TRUE, updated_at = now()`,
              [id, key],
            );
          }
        } else {
          await db.query(
            `INSERT INTO store_page_access (store_id, access_key, enabled)
             VALUES ($1, $2, FALSE)
             ON CONFLICT (store_id, access_key) DO UPDATE SET enabled = FALSE, updated_at = now()`,
            [id, key],
          );
        }
      }
    });

    const reason = entries
      .filter(([, enabled]) => !enabled)
      .map(([key]) => key)
      .join(",");
    await logSuperadminAction(request, "TENANT_ACCESS_UPDATE", { targetTenantId: id, reason: reason || body.reason || null });

    const disabled = await getDisabledAccessKeys(id);
    const granted = await getGrantedAccessKeys(id);
    return { ok: true, pages: buildAccessView(plan, disabled, granted) };
  });
}
