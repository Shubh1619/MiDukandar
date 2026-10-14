import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, qExec, withTx } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { buildUpdate } from "../lib/db.js";
import { authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { logger } from "../lib/logger.js";
import { getModuleLimit, getPlanForBusiness } from "../lib/plans.js";

async function withPlan<T extends Record<string, unknown>>(store: T | null): Promise<(T & { planDetails?: unknown }) | null> {
  if (!store?.id) return store;
  const plan = await getPlanForBusiness(String(store.id));
  return plan ? { ...store, planDetails: plan } : store;
}

const setupSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.string().min(1).max(60),
  address: z.string().max(300).optional().default(""),
  city: z.string().max(60).optional().default(""),
  state: z.string().max(60).optional().default(""),
  pincode: z.string().max(10).optional().default(""),
  phone: z.string().max(15).optional().default(""),
  gst: z.string().max(25).optional().default(""),
  currency: z.string().max(8).optional().default("INR"),
  language: z.string().max(8).optional().default("hi"),
  logoUrl: z.string().max(500).optional().default(""),
  invoicePrefix: z.string().max(10).optional().default("INV"),
});

export async function storeRoutes(app: FastifyInstance) {
  // Create store + bind to caller (Owner).
  app.post(
    "/setup",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest, reply) => {
      const user = getAuth(request);
      if (user.storeId) {
        return reply.status(409).send({ error: "Store already exists for this account.", code: "STORE_EXISTS" });
      }
      const body = parse(setupSchema, request.body);

      const [store] = await q<Record<string, unknown>>(
        `INSERT INTO stores
           (name, type, address, city, state, pincode, phone, gst, currency, language, logo_url, invoice_prefix,
            plan_id, plan_status, trial_ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 (SELECT id FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1),
                 'TRIAL',
                 (SELECT CASE WHEN trial_days > 0 THEN now() + trial_days * interval '1 day' END
                    FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1))
         RETURNING *`,
        [
          body.name, body.type, body.address, body.city, body.state, body.pincode, body.phone,
          body.gst || null, body.currency, body.language, body.logoUrl || null, body.invoicePrefix,
        ],
      );

      await qExec(`UPDATE users SET store_id = $1, role = 'OWNER' WHERE id = $2`, [store.id as string, user.id]);

      logger.info("store: created", { storeId: store.id, userId: user.id });
      return reply.status(201).send({ store: await withPlan(store) });
    },
  );

  // Current store
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const store = await qOne<Record<string, unknown>>(`SELECT * FROM stores WHERE id = $1`, [storeId]);
    if (!store) throw ApiError.notFound("Store not found");
    return { store: await withPlan(store) };
  });

  // Update store (Owner + Manager)
  app.put(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const body = parse(setupSchema.partial(), request.body);
      const entries: Array<[string, unknown]> = [];
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined) continue;
        entries.push([k, k === "gst" && !v ? null : v]);
      }
      const update = buildUpdate("stores", entries, { id: storeId });
      if (!update) return { ok: true };
       const store = await qOne<Record<string, unknown>>(update.sql, update.params);
       return { store: await withPlan(store) };
    },
  );

  // Add staff (Owner) - they can sign in via OTP, tied to the store.
  app.post(
    "/staff",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(2).max(80),
        role: z.enum(["CASHIER", "MANAGER", "STOCK_MANAGER"]).default("CASHIER"),
      });
      const body = parse(schema, request.body);

      await withTx(async (tx) => {
        await tx.query(`SELECT id FROM stores WHERE id = $1 FOR UPDATE`, [storeId]);
        const existing = await tx.qOne<Record<string, unknown>>(`SELECT * FROM users WHERE email = $1`, [
          body.email.toLowerCase(),
        ]);
        const createsNewStaff = !existing?.store_id;
        const staffLimit = await getModuleLimit(storeId, "USERS_ROLES", tx);
        if (createsNewStaff && staffLimit != null && staffLimit > 0) {
          const countRow = await tx.qOne<Record<string, unknown>>(
            `SELECT COUNT(*)::int AS count FROM users WHERE store_id = $1 AND is_active = TRUE AND role <> 'OWNER'`,
            [storeId],
          );
          if (Number(countRow?.count ?? 0) >= staffLimit) {
            throw ApiError.forbidden(`Your plan allows up to ${staffLimit} staff users.`);
          }
        }
        if (existing) {
          if (existing.store_id) throw ApiError.conflict("That user already belongs to a store.");
          await tx.query(`UPDATE users SET store_id = $1, role = $2, name = $3 WHERE id = $4`, [
            storeId, body.role, body.name, existing.id,
          ]);
        } else {
          await tx.query(`INSERT INTO users (email, name, role, store_id) VALUES ($1, $2, $3, $4)`, [
            body.email.toLowerCase(), body.name, body.role, storeId,
          ]);
        }
      });
      logger.info("store: staff added", { storeId, email: body.email, role: body.role });
      return reply.status(201).send({ ok: true });
    },
  );

  // List staff
  app.get("/staff", { preHandler: [authenticate, requireRole(ROLES.OWNER)] }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const staff = await q<Record<string, unknown>>(
      `SELECT id, name, email, role, is_active, last_login_at, created_at
       FROM users WHERE store_id = $1 AND id <> $2 ORDER BY created_at ASC`,
      [storeId, getAuth(request).id],
    );
    return { staff };
  });

  // Activate / deactivate staff
  app.patch(
    "/staff/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { isActive?: boolean };
      await qExec(`UPDATE users SET is_active = $1 WHERE id = $2 AND store_id = $3`, [
        body.isActive ?? false, id, storeId,
      ]);
      return { ok: true };
    },
  );
}