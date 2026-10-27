import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { q, qOne } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { istDateKey } from "../lib/ist.js";
import { maskPhone } from "../lib/logger.js";
import { paginationSchema, parse } from "../lib/validate.js";
import {
  authenticate,
  requirePermission,
  requireRole,
  requireStore,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { reportDeviceDelivery } from "../services/sms.service.js";

/**
 * Per-store SMS allowance, audit log and on/off switch for the udhaari
 * notification. The daily limit itself is platform-controlled (it is a free
 * allowance, not a customer setting), so a store can only turn sends off.
 */
export async function smsRoutes(app: FastifyInstance) {
  // Today's usage meter for the settings screen.
  app.get("/usage", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const day = istDateKey();

    const [store, usage] = await Promise.all([
      qOne<{ sms_udhaari_enabled: boolean; sms_daily_limit: number }>(
        `SELECT sms_udhaari_enabled, sms_daily_limit FROM stores WHERE id = $1`,
        [storeId],
      ),
      qOne<{ used_count: number }>(
        `SELECT used_count FROM sms_usage_daily WHERE store_id = $1 AND day = $2`,
        [storeId, day],
      ),
    ]);

    const limit = Number(store?.sms_daily_limit ?? config.smsDailyFreeLimit);
    const used = Number(usage?.used_count ?? 0);

    return {
      date: day,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      enabled: Boolean(store?.sms_udhaari_enabled),
      mode: config.smsMode,
    };
  });

  // Delivery log. Phone numbers are masked: the full number already lives on
  // the customer record, and the log is for troubleshooting delivery.
  app.get(
    "/messages",
    { preHandler: [authenticate, requirePermission("can_manage_settings")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const query = parse(
        paginationSchema.extend({ status: z.string().max(30).optional() }),
        request.query,
      );
      const status = query.status?.trim() || null;
      const offset = (query.page - 1) * query.limit;

      const [rows, totalRow] = await Promise.all([
        q<{
          id: string;
          customer_name: string | null;
          to_phone: string;
          status: string;
          error_code: string | null;
          template_key: string;
          provider: string | null;
          attempts: number;
          created_at: string;
        }>(
          `SELECT m.id, c.name AS customer_name, m.to_phone, m.status, m.error_code,
                  m.template_key, m.provider, m.attempts, m.created_at
             FROM sms_messages m
             LEFT JOIN customers c ON c.id = m.customer_id
            WHERE m.store_id = $1 AND ($2::text IS NULL OR m.status = $2)
            ORDER BY m.created_at DESC
            LIMIT $3 OFFSET $4`,
          [storeId, status, query.limit, offset],
        ),
        qOne<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM sms_messages
            WHERE store_id = $1 AND ($2::text IS NULL OR status = $2)`,
          [storeId, status],
        ),
      ]);

      return {
        messages: rows.map((row) => ({
          id: row.id,
          customerName: row.customer_name,
          toPhone: maskPhone(row.to_phone),
          status: row.status,
          errorCode: row.error_code,
          templateKey: row.template_key,
          provider: row.provider,
          attempts: Number(row.attempts ?? 0),
          createdAt: row.created_at,
        })),
        total: Number(totalRow?.total ?? 0),
        page: query.page,
        limit: query.limit,
      };
    },
  );

  // Delivery report from the mobile app when SMS_MODE=device. The phone sends
  // from its own SIM and tells us the outcome so the audit log and the daily
  // allowance stay accurate. `can_manage_udhaari` is the same permission that
  // creates the entry in the first place.
  app.post(
    "/messages/:id/delivery",
    { preHandler: [authenticate, requirePermission("can_manage_udhaari")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(
        z.object({ status: z.enum(["SENT", "FAILED", "HANDED_OFF"]) }),
        request.body,
      );

      const result = await reportDeviceDelivery({
        storeId,
        messageId: id,
        status: body.status,
      });
      if (!result) throw ApiError.notFound("SMS message not found");
      return { ok: true, status: result.status };
    },
  );

  // Toggle the udhaari SMS for this store.
  app.patch(
    "/settings",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const body = parse(z.object({ enabled: z.boolean() }), request.body);

      const store = await qOne<{ sms_udhaari_enabled: boolean }>(
        `UPDATE stores
            SET sms_udhaari_enabled = $1, updated_at = now()
          WHERE id = $2
          RETURNING sms_udhaari_enabled`,
        [body.enabled, storeId],
      );
      if (!store) throw ApiError.notFound("Store not found");

      return { ok: true, enabled: store.sms_udhaari_enabled };
    },
  );
}
