import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { logSuperadminAction } from "../lib/superadmin-audit.js";
import { requireSuperAdmin, getSuperadmin } from "../middlewares/superadmin.js";
import { q, qOne, qExec } from "../db/pool.js";

const STATUS = ["ACTIVE", "SUSPENDED"] as const;

const billingQuerySchema = z.object({
  planId: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  search: z.string().max(120).optional().default(""),
  status: z.enum(STATUS).optional(),
  planId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const SETTINGS_WHITELIST = new Set([
  "maintenance_mode",
  "signup_enabled",
  "smtp_paused",
  "default_otp_expiry_minutes",
  "default_otp_length",
]);

export async function superadminRoutes(app: FastifyInstance) {
  // Every route under /api/superadmin (except /auth) requires a platform
  // superadmin token.
  app.addHook("preHandler", requireSuperAdmin);

  // ---------- TENANT LIST ----------
  app.get("/tenants", async (request: FastifyRequest) => {
    const { search, status, planId, page, limit } = parse(listQuerySchema, request.query);
    const like = search.trim() ? `%${search.trim()}%` : null;

    const where = `($1::text IS NULL OR s.name ILIKE $1 OR s.city ILIKE $1 OR u.email ILIKE $1)
       AND ($2::text IS NULL OR s.status = $2)
       AND ($3::uuid IS NULL OR s.plan_id = $3)`;
    const params = [like, status ?? null, planId ?? null];

    const tenants = await q<Record<string, unknown>>(
      `SELECT s.id, s.name, s.type, s.city, s.state, s.status,
              s.plan_id, COALESCE(p.name, s.plan) AS plan, s.plan_status,
              s.trial_ends_at, s.suspended_at, s.suspended_reason, s.created_at,
              u.email AS owner_email,
              (SELECT COUNT(*) FROM sales x WHERE x.store_id = s.id) AS invoice_count,
              (SELECT COUNT(*) FROM customers c WHERE c.store_id = s.id) AS customer_count,
              (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) AS product_count,
              (SELECT COUNT(*) FROM users u3 WHERE u3.store_id = s.id) AS user_count,
              (SELECT MAX(x.created_at) FROM sales x WHERE x.store_id = s.id) AS last_sale_at,
              (SELECT MAX(u2.last_login_at) FROM users u2 WHERE u2.store_id = s.id) AS last_login_at
         FROM stores s
         LEFT JOIN plans p ON p.id = s.plan_id
         LEFT JOIN users u ON u.store_id = s.id AND u.role = 'OWNER'
        WHERE ${where}
        ORDER BY s.created_at DESC
        LIMIT $4 OFFSET $5`,
      [...params, limit, (page - 1) * limit],
    );

    const [countRow] = await q<Record<string, unknown>>(
      `SELECT COUNT(DISTINCT s.id) AS total FROM stores s LEFT JOIN plans p ON p.id = s.plan_id LEFT JOIN users u ON u.store_id = s.id AND u.role = 'OWNER' WHERE ${where}`,
      params,
    );

    await logSuperadminAction(request, "TENANTS_LIST", { reason: `page ${page}` });

    return {
      total: Number(countRow?.total ?? 0),
      page,
      limit,
      tenants: tenants.map((t) => ({
        ...t,
        lastActiveAt: pickMaxDate(t.lastSaleAt, t.lastLoginAt),
      })),
    };
  });

  // ---------- TENANT DETAIL ----------
  const tenantIdParams = z.object({ id: z.string().uuid() });

  app.get("/tenants/:id", async (request: FastifyRequest) => {
    const { id } = parse(tenantIdParams, request.params);

    const store = await qOne<Record<string, unknown>>(
      `SELECT s.*, COALESCE(p.name, s.plan) AS plan_name, p.status AS plan_definition_status,
              p.price_monthly, p.price_yearly, u.email AS owner_email
         FROM stores s
         LEFT JOIN plans p ON p.id = s.plan_id
         LEFT JOIN users u ON u.store_id = s.id AND u.role = 'OWNER'
        WHERE s.id = $1`,
      [id],
    );
    if (!store) throw ApiError.notFound("Tenant not found.");

    const [statsRow] = await q<Record<string, unknown>>(
      `SELECT
        (SELECT COUNT(*) FROM sales x WHERE x.store_id = $1) AS invoice_count,
        (SELECT COALESCE(SUM(x.total), 0) FROM sales x WHERE x.store_id = $1) AS total_revenue,
        (SELECT COALESCE(SUM(x.paid_amount), 0) FROM sales x WHERE x.store_id = $1) AS collected,
        (SELECT COALESCE(SUM(x.due_amount), 0) FROM sales x WHERE x.store_id = $1) AS outstanding,
        (SELECT COUNT(*) FROM customers c WHERE c.store_id = $1) AS customer_count,
        (SELECT COUNT(*) FROM products p WHERE p.store_id = $1) AS product_count,
        (SELECT COUNT(*) FROM users u2 WHERE u2.store_id = $1) AS user_count`,
      [id],
    );
    const recentSales = await q<Record<string, unknown>>(
      `SELECT id, invoice_number, total, paid_amount, payment_mode, status, created_at
         FROM sales WHERE store_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [id],
    );

    await logSuperadminAction(request, "TENANT_VIEW", { targetTenantId: id });

    return { store, stats: statsRow ?? {}, recentSales };
  });

  // ---------- TENANT USERS ----------
  app.get("/tenants/:id/users", async (request: FastifyRequest) => {
    const { id } = parse(tenantIdParams, request.params);

    const users = await q<Record<string, unknown>>(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.last_login_at, u.created_at
         FROM users u WHERE u.store_id = $1 ORDER BY u.created_at`,
      [id],
    );

    await logSuperadminAction(request, "TENANT_USERS_VIEW", { targetTenantId: id });

    return { users };
  });

  // ---------- TENANT SUSPEND / ACTIVATE ----------
  const statusSchema = z.object({
    action: z.enum(["SUSPEND", "ACTIVATE"]),
    reason: z.string().min(3).max(500),
  });

  app.patch("/tenants/:id/status", async (request: FastifyRequest) => {
    const { id } = parse(tenantIdParams, request.params);
    const body = parse(statusSchema, request.body);

    const store = await qOne<{ id: string; status: string }>(`SELECT id, status FROM stores WHERE id = $1`, [id]);
    if (!store) throw ApiError.notFound("Tenant not found.");

    if (body.action === "SUSPEND") {
      if (store.status === "SUSPENDED") throw ApiError.conflict("Tenant is already suspended.");
      await qExec(
        `UPDATE stores SET status = 'SUSPENDED', suspended_at = now(), suspended_reason = $2, updated_at = now() WHERE id = $1`,
        [id, body.reason],
      );
    } else {
      if (store.status !== "SUSPENDED") throw ApiError.conflict("Tenant is already active.");
      await qExec(
        `UPDATE stores SET status = 'ACTIVE', suspended_at = NULL, suspended_reason = NULL, updated_at = now() WHERE id = $1`,
        [id],
      );
    }

    await logSuperadminAction(request, body.action === "SUSPEND" ? "TENANT_SUSPEND" : "TENANT_ACTIVATE", {
      targetTenantId: id,
      reason: body.reason,
    });

    return { ok: true, id, status: body.action === "SUSPEND" ? "SUSPENDED" : "ACTIVE" };
  });

  // ---------- IMPERSONATE ----------
  const impersonateSchema = z.object({
    reason: z.string().min(3).max(500),
  });

  app.post("/tenants/:id/impersonate", async (request: FastifyRequest) => {
    const sa = getSuperadmin(request);
    const { id } = parse(tenantIdParams, request.params);
    const { reason } = parse(impersonateSchema, request.body);

    const store = await qOne<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM stores WHERE id = $1`,
      [id],
    );
    if (!store) throw ApiError.notFound("Tenant not found.");
    if (store.status !== "ACTIVE") throw ApiError.badRequest("Tenant is suspended - you cannot impersonate it.");

    const user = await qOne<Record<string, unknown>>(
      `SELECT * FROM users WHERE store_id = $1 AND is_active = TRUE
       ORDER BY (role = 'OWNER') DESC, last_login_at DESC NULLS LAST LIMIT 1`,
      [id],
    );
    if (!user) throw ApiError.badRequest("Tenant has no active users to impersonate.");

    const minutes = config.superAdminImpersonationMinutes;
    const accessToken = app.jwt.sign(
      {
        sub: user.id as string,
        id: user.id as string,
        email: user.email as string,
        role: (user.role as string) ?? "OWNER",
        businessId: store.id,
        storeId: store.id,
        name: (user.name as string) ?? null,
        imp: true,
        impersonatedBy: sa.id,
        impersonatedByName: sa.name,
        reason,
        impExpiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      },
      { expiresIn: minutes * 60 },
    );

    await logSuperadminAction(request, "TENANT_IMPERSONATE", {
      targetTenantId: store.id,
      targetUserId: user.id as string,
      reason,
    });

    return {
      ok: true,
      accessToken,
      expiresInSeconds: minutes * 60,
      reason,
      tenant: { id: store.id, name: store.name },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  });

  // ---------- BILLING ----------
  app.get("/billing", async (request: FastifyRequest) => {
    const { planId } = parse(billingQuerySchema, request.query);
    const rows = await q<Record<string, unknown>>(
      `SELECT s.id, s.name, s.status, s.plan_id, COALESCE(p.name, s.plan) AS plan, s.plan_status,
              s.trial_ends_at, s.created_at, p.price_monthly, p.price_yearly,
              (SELECT COUNT(*) FROM sales x WHERE x.store_id = s.id) AS invoice_count,
              (SELECT COALESCE(SUM(x.total), 0) FROM sales x WHERE x.store_id = s.id) AS total_revenue,
              (SELECT COALESCE(SUM(x.paid_amount), 0) FROM sales x WHERE x.store_id = s.id) AS collected,
              (SELECT COALESCE(SUM(x.due_amount), 0) FROM sales x WHERE x.store_id = s.id) AS outstanding
         FROM stores s
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE ($1::uuid IS NULL OR s.plan_id = $1)
        ORDER BY s.created_at DESC`,
      [planId ?? null],
    );
    const plans = await q<Record<string, unknown>>(
      `SELECT id, name, price_monthly, price_yearly FROM plans WHERE status = 'ACTIVE' ORDER BY display_order ASC, created_at ASC`,
    );

    const summary = {
      tenants: rows.length,
      active: rows.filter((r) => r.status === "ACTIVE").length,
      suspended: rows.filter((r) => r.status === "SUSPENDED").length,
      onPaidPlan: rows.filter((r) => Number(r.priceMonthly ?? r.price_monthly ?? 0) > 0).length,
      totalRevenue: rows.reduce((sum, r) => sum + Number(r.totalRevenue ?? 0), 0),
    };

    await logSuperadminAction(request, "BILLING_VIEW");

    return { summary, plans, tenants: rows };
  });

  // ---------- PLATFORM SETTINGS ----------
  app.get("/settings", async (request: FastifyRequest) => {
    const rows = await q<{ key: string; value: unknown }>(`SELECT key, value FROM platform_settings ORDER BY key`);
    const settings: Record<string, unknown> = {};
    for (const r of rows) settings[r.key] = r.value;

    await logSuperadminAction(request, "SETTINGS_VIEW");

    return { settings };
  });

  const settingsPatchSchema = z.object({
    updates: z.record(z.union([z.boolean(), z.number(), z.string()])),
  });

  app.patch("/settings", async (request: FastifyRequest) => {
    const sa = getSuperadmin(request);
    const { updates } = parse(settingsPatchSchema, request.body);

    const applied: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!SETTINGS_WHITELIST.has(key)) continue;
      await qExec(
        `INSERT INTO platform_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, value, sa.id],
      );
      applied[key] = value;
    }

    await logSuperadminAction(request, "SETTINGS_UPDATE", { reason: Object.keys(applied).join(",") });

    return { ok: true, applied };
  });

  // ---------- LOGS ----------
  const logsQuerySchema = z.object({
    action: z.string().max(60).optional(),
    tenantId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });

  app.get("/logs", async (request: FastifyRequest) => {
    const { action, tenantId, limit } = parse(logsQuerySchema, request.query);

    const superadminLogs = await q<Record<string, unknown>>(
      `SELECT l.id, l.action, l.reason, l.ip_address, l.created_at,
              sa.email AS superadmin_email, sa.name AS superadmin_name,
              st.name AS tenant_name
         FROM superadmin_audit_logs l
         LEFT JOIN super_admins sa ON sa.id = l.superadmin_id
         LEFT JOIN stores st ON st.id = l.target_tenant_id
        WHERE ($1::text IS NULL OR l.action = $1)
          AND ($2::uuid IS NULL OR l.target_tenant_id = $2)
        ORDER BY l.created_at DESC
        LIMIT $3`,
      [action ?? null, tenantId ?? null, limit],
    );

    const tenantLogs = await q<Record<string, unknown>>(
      `SELECT l.id, l.action, l.detail, l.ip, l.created_at,
              st.name AS tenant_name, u.email AS user_email
         FROM audit_logs l
         LEFT JOIN stores st ON st.id = l.store_id
         LEFT JOIN users u ON u.id = l.user_id
         WHERE ($1::uuid IS NULL OR l.store_id = $1)
        ORDER BY l.created_at DESC
        LIMIT $2`,
      [tenantId ?? null, limit],
    );

    await logSuperadminAction(request, "LOGS_VIEW");

    return { superadminLogs, tenantLogs };
  });
}

function pickMaxDate(a: unknown, b: unknown): Date | null {
  const va = a ? new Date(a as string).getTime() : 0;
  const vb = b ? new Date(b as string).getTime() : 0;
  if (!va && !vb) return null;
  return new Date(Math.max(va, vb));
}