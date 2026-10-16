import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q, qOne, qExec, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { authenticate, getAuth, requireStore, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";
import { getModuleLimit, hasModuleAccess } from "../lib/plans.js";

const roleSchema = z.enum(["MANAGER", "CASHIER", "STAFF"]);

// Build the invitee-facing accept URL. When APP_URL is configured (the web
// origin) we return an absolute link so it can be copied/shared as-is; in
// local development without APP_URL we fall back to the relative path, which
// the web client resolves against its own origin.
const inviteAcceptUrl = (token: string): string => {
  const base = config.appUrl.replace(/\/+$/, "");
  const path = `/invite/accept?token=${token}`;
  return base ? `${base}${path}` : path;
};

const userJson = (row: Row) => ({
  id: row.id as string,
  name: (row.name as string | null) ?? "",
  email: (row.email as string | null) ?? "",
  phone: (row.phone as string | null) ?? "",
  role: row.role as string,
  status: row.is_active ? "active" : "inactive",
  isActive: Boolean(row.is_active),
  lastLogin: (row.last_login_at as string | null) ?? null,
  last_login_at: (row.last_login_at as string | null) ?? null,
  createdAt: row.created_at,
});

const inviteJson = (row: Row) => ({
  id: row.id as string,
  name: (row.name as string | null) ?? "",
  email: (row.email as string | null) ?? "",
  phone: (row.phone as string | null) ?? "",
  role: row.role as string,
  status: row.status as string,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  invitedByName: (row.invited_by_name as string | null) ?? null,
});

async function assertNotLastOwner(storeId: string, userId: string) {
  const target = await qOne<Row>(
    `SELECT id, role, is_active FROM users WHERE id = $1 AND store_id = $2`,
    [userId, storeId],
  );
  if (!target) throw ApiError.notFound("User not found.");
  if (target.role !== "OWNER" || target.is_active === false) return;
  const owners = await qOne<Row>(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE store_id = $1 AND role = 'OWNER' AND is_active = TRUE AND id <> $2`,
    [storeId, userId],
  );
  if ((owners?.count as number) < 1) {
    throw ApiError.badRequest("Cannot remove or deactivate the last active Owner.");
  }
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const users = await q<Row>(
      `SELECT id, name, email, phone, role, is_active, last_login_at, created_at
       FROM users
       WHERE store_id = $1
       ORDER BY CASE role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 WHEN 'CASHIER' THEN 3 ELSE 4 END, created_at ASC`,
      [storeId],
    );
    const invites = await q<Row>(
      // Expiry is derived here rather than persisted by a write on this GET.
      // This route previously ran `UPDATE user_invites SET status='expired'`
      // before listing, so a crawler, link preview or prefetch that hit the
      // endpoint mutated data, and the response depended on that mutation.
      // The list is unchanged: the sweep ran first and the query filtered on
      // status='pending', so expired invites were already excluded. The stored
      // status now settles lazily — /invite/accept already marks an expired
      // invite as expired in-transaction, and /invite/:id/resend accepts both
      // 'pending' and 'expired'.
      `SELECT ui.*, u.name AS invited_by_name
       FROM user_invites ui
       LEFT JOIN users u ON u.id = ui.invited_by
       WHERE ui.store_id = $1
         AND ui.status = 'pending'
         AND (ui.expires_at IS NULL OR ui.expires_at >= now())
       ORDER BY ui.created_at DESC`,
      [storeId],
    );
    return { users: users.map(userJson), invites: invites.map(inviteJson) };
  });

  app.post(
    "/invite",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const auth = getAuth(request);
      const body = parse(
        z.object({
          name: z.string().min(2).max(80),
          email: z.string().email(),
          phone: z.string().min(6).max(20).optional().or(z.literal("")),
          role: roleSchema,
        }),
        request.body,
      );
       const email = body.email.trim().toLowerCase();
       const phone = body.phone ? body.phone.trim() : null;
       const staffLimit = await getModuleLimit(storeId, "USERS_ROLES");
       if (staffLimit != null && staffLimit > 0) {
          const countRow = await qOne<Row>(`SELECT COUNT(*)::int AS count FROM users WHERE store_id = $1 AND is_active = TRUE AND role <> 'OWNER'`, [storeId]);
          if (Number(countRow?.count ?? 0) >= staffLimit) {
           throw ApiError.forbidden(`Your plan allows up to ${staffLimit} staff users.`);
         }
       }

       if (email) {
        const existing = await qOne<Row>(`SELECT id, store_id FROM users WHERE email = $1`, [email]);
        if (existing?.store_id && existing.store_id !== storeId) {
          throw ApiError.conflict("That user already belongs to another store.");
        }
      }

      const token = randomBytes(32).toString("base64url");
      const invite = await qOne<Row>(
        `INSERT INTO user_invites (store_id, name, email, phone, role, invite_token, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '48 hours')
         RETURNING *`,
        [storeId, body.name.trim(), email, phone, body.role, token, auth.id],
      );
      logger.info("users: invite created", { storeId, email, phone, role: body.role });
      const inviteLink = inviteAcceptUrl(token);
      return reply.status(201).send({ invite: inviteJson(invite as Row), inviteLink });
    },
  );

  app.post("/invite/accept", async (request, reply) => {
    const body = parse(
      z.object({
        token: z.string().min(20),
        name: z.string().min(2).max(80).optional(),
        password: z.string().min(6).max(100),
      }),
      request.body,
    );
    // Async form: this route is intentionally UNAUTHENTICATED (the invitee has
    // only the emailed token), so a sync hash here would let an unauthenticated
    // caller block the event loop for every tenant.
    const passwordHash = await bcrypt.hash(body.password, 10);
    const accepted = await withTx(async (db) => {
      const invite = await db.qOne<Row>(
        `SELECT * FROM user_invites WHERE invite_token = $1 AND status = 'pending' FOR UPDATE`,
        [body.token],
      );
      if (!invite) throw ApiError.notFound("Invite not found or already used.");
      if (new Date(invite.expires_at as Date) < new Date()) {
        await db.query(`UPDATE user_invites SET status = 'expired', updated_at = now() WHERE id = $1`, [invite.id]);
        throw ApiError.badRequest("Invite has expired.");
      }
      if (!(await hasModuleAccess(String(invite.store_id), "USERS_ROLES", db))) {
        throw ApiError.forbidden("Upgrade your plan to unlock this module.");
      }
      const email = invite.email as string | null;
      if (!email) throw ApiError.badRequest("Email is required to accept this invite.");

      let user = await db.qOne<Row>(`SELECT * FROM users WHERE email = $1`, [email]);
      if (user?.store_id && String(user.store_id) !== String(invite.store_id)) {
        throw ApiError.conflict("That user already belongs to another store.");
      }
      const alreadyInStore = Boolean(user?.store_id && String(user.store_id) === String(invite.store_id));
      if (!alreadyInStore) {
        const staffLimit = await getModuleLimit(String(invite.store_id), "USERS_ROLES", db);
        if (staffLimit != null && staffLimit > 0) {
          const countRow = await db.qOne<Row>(
            `SELECT COUNT(*)::int AS count FROM users WHERE store_id = $1 AND is_active = TRUE AND role <> 'OWNER'`,
            [invite.store_id],
          );
          if (Number(countRow?.count ?? 0) >= staffLimit) {
            throw ApiError.forbidden(`Your plan allows up to ${staffLimit} staff users.`);
          }
        }
      }

      if (user) {
        await db.query(
          `UPDATE users
           SET store_id = $1, name = $2, phone = COALESCE($3, phone), role = $4, is_active = TRUE, password_hash = $5, updated_at = now()
           WHERE id = $6`,
          [
            invite.store_id,
            body.name?.trim() || invite.name || user.name,
            invite.phone ?? null,
            invite.role,
            passwordHash,
            user.id,
          ],
        );
        const updated = await db.qOne<Row>(`SELECT * FROM users WHERE id = $1`, [user.id]);
        user = updated;
      } else {
        const rows = await db.q<Row>(
          `INSERT INTO users (email, name, phone, role, store_id, password_hash, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           RETURNING *`,
          [email, body.name?.trim() || invite.name || email.split("@")[0], invite.phone ?? null, invite.role, invite.store_id, passwordHash],
        );
        user = rows[0];
      }
      await db.query(
        `UPDATE user_invites SET status = 'accepted', accepted_by = $1, updated_at = now() WHERE id = $2`,
        [user!.id, invite.id],
      );
      return user!;
    });
    return reply.status(201).send({ ok: true, user: userJson(accepted) });
  });

  app.post(
    "/invite/:id/resend",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const token = randomBytes(32).toString("base64url");
      const invite = await qOne<Row>(
        `UPDATE user_invites
         SET invite_token = $1, status = 'pending', expires_at = now() + interval '48 hours', updated_at = now()
         WHERE id = $2 AND store_id = $3 AND status IN ('pending','expired')
         RETURNING *`,
        [token, id, storeId],
      );
      if (!invite) throw ApiError.notFound("Invite not found.");
      return { invite: inviteJson(invite), inviteLink: inviteAcceptUrl(token) };
    },
  );

  app.delete(
    "/invite/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const count = await qExec(
        `UPDATE user_invites SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND store_id = $2 AND status = 'pending'`,
        [id, storeId],
      );
      if (!count) throw ApiError.notFound("Invite not found.");
      return reply.status(204).send();
    },
  );

  app.patch(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(
        z.object({
          name: z.string().min(2).max(80).optional(),
          role: z.enum(["OWNER", "MANAGER", "CASHIER", "STAFF"]).optional(),
          status: z.enum(["active", "inactive"]).optional(),
          isActive: z.boolean().optional(),
        }),
        request.body,
      );
      const isActive = body.status ? body.status === "active" : body.isActive;
      if (isActive === false || (body.role && body.role !== "OWNER")) {
        await assertNotLastOwner(storeId, id);
      }
      const updates: string[] = [];
      const params: unknown[] = [];
      if (body.name !== undefined) {
        params.push(body.name.trim());
        updates.push(`name = $${params.length}`);
      }
      if (body.role !== undefined) {
        params.push(body.role);
        updates.push(`role = $${params.length}`);
      }
      if (isActive !== undefined) {
        params.push(isActive);
        updates.push(`is_active = $${params.length}`);
      }
      if (!updates.length) return { ok: true };
      params.push(id, storeId);
      const user = await qOne<Row>(
        `UPDATE users SET ${updates.join(", ")}, updated_at = now()
         WHERE id = $${params.length - 1} AND store_id = $${params.length}
         RETURNING id, name, email, phone, role, is_active, last_login_at, created_at`,
        params,
      );
      if (!user) throw ApiError.notFound("User not found.");
      return { user: userJson(user) };
    },
  );

  app.patch(
    "/:id/status",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(z.object({ status: z.enum(["active", "inactive"]).optional(), isActive: z.boolean().optional() }), request.body);
      const active = body.status ? body.status === "active" : Boolean(body.isActive);
      if (!active) await assertNotLastOwner(storeId, id);
      const user = await qOne<Row>(
        `UPDATE users SET is_active = $1, updated_at = now()
         WHERE id = $2 AND store_id = $3
         RETURNING id, name, email, phone, role, is_active, last_login_at, created_at`,
        [active, id, storeId],
      );
      if (!user) throw ApiError.notFound("User not found.");
      return { user: userJson(user) };
    },
  );

  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      await assertNotLastOwner(storeId, id);
      const count = await qExec(`DELETE FROM users WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!count) throw ApiError.notFound("User not found.");
      return reply.status(204).send();
    },
  );
}
