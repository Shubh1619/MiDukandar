import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, qClient, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, requirePermission, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { getCustomerOutstanding, createLedgerEntry } from "../services/ledger.service.js";
import { insertPayment } from "../services/payment.service.js";
import { logger } from "../lib/logger.js";
import { invalidateDashboardCache } from "../lib/dashboard-cache.js";

export async function paymentRoutes(app: FastifyInstance) {
  const paymentSchema = z.object({
    customerId: z.string().min(1),
    amount: z.coerce.number().positive(),
    mode: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
    note: z.string().max(200).optional().default(""),
  });

  // Record a payment received from a customer (reduces udhaari)
  app.post(
    "/receive",
    { preHandler: [authenticate, requirePermission("can_manage_udhaari")] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const body = parse(paymentSchema, request.body);

      const customer = await qOne<Row>(`SELECT * FROM customers WHERE id = $1 AND store_id = $2`, [
        body.customerId,
        storeId,
      ]);
      if (!customer) throw ApiError.notFound("Customer not found");

      const out = await withTx(async (tx) => {
        const payment = await insertPayment(tx, {
          storeId,
          customerId: body.customerId,
          amount: body.amount,
          type: "RECEIVED",
          mode: body.mode,
          referenceType: "CUSTOMER_PAYMENT",
          referenceId: body.customerId,
          note: body.note || null,
          createdById: getAuth(request).id,
        });
        const balanceAfter = await createLedgerEntry(tx, {
          customerId: body.customerId,
          storeId,
          type: "CREDIT",
          amount: body.amount,
          referenceType: "PAYMENT",
          referenceId: payment.id as string,
          note: body.note || "Customer payment received",
        });
        return balanceAfter;
      });

      logger.info("payment: received", { storeId, customerId: body.customerId, amount: body.amount });
      invalidateDashboardCache(storeId);
      const outstanding = await getCustomerOutstanding(qClient(), body.customerId);
      return reply.status(201).send({ ok: true, balanceAfter: out, outstanding });
    },
  );

  // List payments
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({ customerId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
      request.query,
    );
    const conditions = ["p.store_id = $1"];
    const params: unknown[] = [storeId];
    if (query.customerId) { params.push(query.customerId); conditions.push(`p.customer_id = $${params.length}`); }
    if (query.from) { params.push(query.from); conditions.push(`p.created_at >= $${params.length}`); }
    if (query.to) { params.push(query.to); conditions.push(`p.created_at <= $${params.length}`); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const totalRow = await qOne<{ c: number }>(`SELECT COUNT(*) AS c FROM payments p ${where}`, params);
    const payments = await q<Row>(
      `SELECT p.*, c.name AS customer_name FROM payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         ${where} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return { total: Number(totalRow?.c ?? 0), page: query.page, limit: query.limit, payments };
  });
}