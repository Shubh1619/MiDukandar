import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, type DbClient, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { logSuperadminAction } from "../lib/superadmin-audit.js";
import {
  PLAN_ADS_TIERS,
  PLAN_MODULE_KEYS,
  PLAN_STATUSES,
  getPlanById,
  normalizeModuleKey,
  type PlanDefinition,
  type PlanModuleInput,
} from "../lib/plans.js";
import { requireSuperAdmin, getSuperadmin } from "../middlewares/superadmin.js";

const moduleKeySchema = z.string().refine(
  (value) => PLAN_MODULE_KEYS.includes(value.trim().toUpperCase() as (typeof PLAN_MODULE_KEYS)[number]),
  "Unknown plan module.",
);

const planModuleSchema = z.object({
  moduleKey: moduleKeySchema,
  enabled: z.boolean(),
  limitValue: z.number().int().min(0).nullable().optional().default(null),
});

const planBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).default(""),
  priceMonthly: z.coerce.number().min(0).max(99999999),
  priceYearly: z.coerce.number().min(0).max(999999999),
  trialDays: z.coerce.number().int().min(0).max(3650).default(0),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  status: z.enum(PLAN_STATUSES),
  isPopular: z.boolean().default(false),
  adsEnabled: z.boolean().default(false),
  adsTier: z.enum(PLAN_ADS_TIERS).default("STANDARD"),
  supportTier: z.string().trim().max(100).default(""),
  customFeatures: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  modules: z.array(planModuleSchema).min(1).max(PLAN_MODULE_KEYS.length),
}).superRefine((body, ctx) => {
  const keys = body.modules.map((module) => module.moduleKey.trim().toUpperCase());
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["modules"], message: "Each module can only be listed once." });
  }
  if (!body.modules.some((module) => module.enabled)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["modules"], message: "Enable at least one module." });
  }
});

const listQuerySchema = z.object({
  status: z.enum(PLAN_STATUSES).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });
const statusSchema = z.object({ status: z.enum(PLAN_STATUSES) });
const tenantPlanSchema = z.object({
  planId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

function normalizedModules(modules: PlanModuleInput[]) {
  return modules.map((module) => ({
    moduleKey: normalizeModuleKey(module.moduleKey),
    enabled: module.enabled,
    limitValue: module.limitValue ?? null,
  }));
}

async function assertUniqueName(db: DbClient, name: string, excludeId?: string) {
  const row = await db.qOne<Row>(
    `SELECT id FROM plans WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [name, excludeId ?? null],
  );
  if (row) throw ApiError.conflict("A plan with this name already exists.");
}

async function insertModules(db: DbClient, planId: string, modules: PlanModuleInput[]) {
  for (const module of normalizedModules(modules)) {
    await db.query(
      `INSERT INTO plan_modules (plan_id, module_key, enabled, limit_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value`,
      [planId, module.moduleKey, module.enabled, module.limitValue],
    );
  }
}

async function uniqueCopyName(db: DbClient, sourceName: string) {
  const base = `${sourceName} (Copy)`;
  let candidate = base;
  let suffix = 2;
  while (await db.qOne<Row>(`SELECT id FROM plans WHERE lower(name) = lower($1)`, [candidate])) {
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function superadminPlanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireSuperAdmin);

  app.get("/plans", async (request) => {
    const { status } = parse(listQuerySchema, request.query);
    const rows = await q<Row>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM stores s WHERE s.plan_id = p.id AND s.status = 'ACTIVE' AND s.plan_status <> 'CANCELED') AS active_business_count,
              (SELECT COUNT(*) FROM plan_modules pm WHERE pm.plan_id = p.id AND pm.enabled = TRUE) AS module_count
         FROM plans p
        WHERE ($1::text IS NULL OR p.status = $1)
        ORDER BY p.display_order ASC, p.created_at ASC`,
      [status ?? null],
    );
    const plans = await Promise.all(rows.map(async (row) => getPlanById(String(row.id))));
    await logSuperadminAction(request, "PLANS_LIST", { reason: status ?? "all" });
    return { plans: plans.filter((plan): plan is PlanDefinition => plan !== null) };
  });

  app.get("/plans/:id", async (request) => {
    const { id } = parse(idSchema, request.params);
    const plan = await getPlanById(id);
    if (!plan) throw ApiError.notFound("Plan not found.");
    await logSuperadminAction(request, "PLAN_VIEW", { reason: id });
    return { plan };
  });

  app.post("/plans", async (request, reply) => {
    const body = parse(planBodySchema, request.body);
    const planId = await withTx(async (db) => {
      await assertUniqueName(db, body.name);
      const [created] = await db.q<Row>(
        `INSERT INTO plans
           (name, description, price_monthly, price_yearly, trial_days, display_order, status,
            is_popular, ads_enabled, ads_tier, support_tier, custom_features)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[])
         RETURNING id`,
        [
          body.name,
          body.description,
          body.priceMonthly,
          body.priceYearly,
          body.trialDays,
          body.displayOrder,
          body.status,
          body.isPopular,
          body.adsEnabled,
          body.adsTier,
          body.supportTier,
          body.customFeatures,
        ],
      );
      const id = String(created.id);
      await insertModules(db, id, body.modules);
      if (body.isPopular) await db.query(`UPDATE plans SET is_popular = FALSE WHERE id <> $1`, [id]);
      return id;
    });
    await logSuperadminAction(request, "PLAN_CREATE", { reason: body.name });
    return reply.status(201).send({ plan: await getPlanById(planId) });
  });

  app.patch("/plans/:id", async (request) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(planBodySchema, request.body);
    const plan = await withTx(async (db) => {
      const current = await db.qOne<Row>(`SELECT id, name, status, is_default FROM plans WHERE id = $1`, [id]);
      if (!current) throw ApiError.notFound("Plan not found.");
      if (
        current.isDefault === true &&
        (String(current.name).trim().toLowerCase() !== body.name.trim().toLowerCase() || body.status !== "ACTIVE")
      ) {
        throw ApiError.conflict("The default Free plan cannot be renamed or archived.");
      }
      await assertUniqueName(db, body.name, id);
      await db.query(
        `UPDATE plans
            SET name = $2, description = $3, price_monthly = $4, price_yearly = $5,
                trial_days = $6, display_order = $7, status = $8, is_popular = $9,
                ads_enabled = $10, ads_tier = $11, support_tier = $12,
                custom_features = $13::text[], updated_at = now()
          WHERE id = $1`,
        [
          id,
          body.name,
          body.description,
          body.priceMonthly,
          body.priceYearly,
          body.trialDays,
          body.displayOrder,
          body.status,
          body.isPopular,
          body.adsEnabled,
          body.adsTier,
          body.supportTier,
          body.customFeatures,
        ],
      );
      await db.query(`DELETE FROM plan_modules WHERE plan_id = $1`, [id]);
      await insertModules(db, id, body.modules);
      if (body.isPopular) await db.query(`UPDATE plans SET is_popular = FALSE WHERE id <> $1`, [id]);
      return id;
    });
    await logSuperadminAction(request, "PLAN_UPDATE", { reason: `${id}:${body.name}` });
    return { plan: await getPlanById(plan) };
  });

  app.patch("/plans/:id/status", async (request) => {
    const { id } = parse(idSchema, request.params);
    const { status } = parse(statusSchema, request.body);
    const current = await qOne<Row>(`SELECT id, is_default FROM plans WHERE id = $1`, [id]);
    if (!current) throw ApiError.notFound("Plan not found.");
    if (current.isDefault === true && status !== "ACTIVE") {
      throw ApiError.conflict("The default Free plan cannot be archived or made inactive.");
    }
    const plan = await qOne<Row>(`UPDATE plans SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, status]);
    await logSuperadminAction(request, "PLAN_STATUS_UPDATE", { reason: `${id}:${status}` });
    return { plan: await getPlanById(id) };
  });

  app.post("/plans/:id/duplicate", async (request, reply) => {
    const { id } = parse(idSchema, request.params);
    const source = await getPlanById(id);
    if (!source) throw ApiError.notFound("Plan not found.");
    const newId = await withTx(async (db) => {
      const name = await uniqueCopyName(db, source.name);
      const [created] = await db.q<Row>(
        `INSERT INTO plans
           (name, description, price_monthly, price_yearly, trial_days, display_order, status,
            is_popular, ads_enabled, ads_tier, support_tier, custom_features)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', FALSE, $7, $8, $9, $10::text[])
         RETURNING id`,
        [
          name,
          source.description,
          source.priceMonthly,
          source.priceYearly,
          source.trialDays,
          source.displayOrder + 1,
          source.adsEnabled,
          source.adsTier,
          source.supportTier,
          source.customFeatures,
        ],
      );
      const copyId = String(created.id);
      await insertModules(db, copyId, source.modules);
      return copyId;
    });
    await logSuperadminAction(request, "PLAN_DUPLICATE", { reason: `${id}:${newId}` });
    return reply.status(201).send({ plan: await getPlanById(newId) });
  });

  app.delete("/plans/:id", async (request) => {
    const { id } = parse(idSchema, request.params);
    const current = await qOne<Row>(`SELECT id, is_default FROM plans WHERE id = $1`, [id]);
    if (!current) throw ApiError.notFound("Plan not found.");
    if (current.isDefault === true) {
      throw ApiError.conflict("The default Free plan cannot be archived.");
    }
    const active = await qOne<Row>(
      `SELECT COUNT(*)::int AS count FROM stores WHERE plan_id = $1 AND status = 'ACTIVE' AND plan_status <> 'CANCELED'`,
      [id],
    );
    if (Number(active?.count ?? 0) > 0) {
      throw ApiError.conflict("Plans with active businesses cannot be deleted. Archive the plan instead.");
    }
    const result = await q<Row>(`UPDATE plans SET status = 'ARCHIVED', updated_at = now() WHERE id = $1 RETURNING id`, [id]);
    if (!result[0]) throw ApiError.notFound("Plan not found.");
    await logSuperadminAction(request, "PLAN_ARCHIVE", { reason: id });
    return { ok: true, archived: true };
  });

  app.patch("/tenants/:id/plan", async (request) => {
    const { id } = parse(idSchema, request.params);
    const body = parse(tenantPlanSchema, request.body);
    const plan = await qOne<Row>(`SELECT id, name, status FROM plans WHERE id = $1`, [body.planId]);
    if (!plan) throw ApiError.notFound("Plan not found.");
    if (plan.status !== "ACTIVE") throw ApiError.badRequest("Only active plans can be assigned to a business.");
    const updated = await q<Row>(
      `UPDATE stores
          SET plan_id = $2, plan = $3, plan_status = 'ACTIVE', trial_ends_at = NULL, updated_at = now()
        WHERE id = $1
        RETURNING id, plan_id, plan`,
      [id, body.planId, plan.name],
    );
    if (!updated[0]) throw ApiError.notFound("Tenant not found.");
    const sa = getSuperadmin(request);
    await logSuperadminAction(request, "TENANT_PLAN_OVERRIDE", { targetTenantId: id, reason: body.reason });
    return { ok: true, planId: body.planId, updatedBy: sa.id };
  });
}
