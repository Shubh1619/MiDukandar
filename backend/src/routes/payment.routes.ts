import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, qClient, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, requirePermission, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { getCustomerOutstanding, createLedgerEntry } from "../services/ledger.service.js";
import { insertPayment } from "../services/payment.service.js";
import { notifyUdhaariPayment, type PendingSms } from "../services/sms.service.js";
import { applyUdhaariPayment } from "./udhaari.routes.js";
import { dec, dmin, moneyNum } from "../lib/money.js";
import { config } from "../config.js";
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
        const auth = getAuth(request);
        const note = body.note || "Customer payment received";

        // Allocate the receipt to the customer's oldest open udhaari entries.
        // The Udhaari screen reads `udhaari_payments`, so without these rows a
        // payment recorded here would only change the ledger/dashboard and the
        // Udhaari list would keep showing the old outstanding balance.
        const openEntries = await tx.q<Row>(
          `SELECT ue.id, ue.customer_id, ue.amount, ue.sale_id,
                  COALESCE(SUM(up.amount), 0) AS paid_amount
             FROM udhaari_entries ue
             LEFT JOIN udhaari_payments up
               ON up.udhaari_entry_id = ue.id AND up.store_id = ue.store_id
            WHERE ue.store_id = $1 AND ue.customer_id = $2
            GROUP BY ue.id, ue.customer_id, ue.amount, ue.sale_id
           HAVING COALESCE(SUM(up.amount), 0) < ue.amount
            ORDER BY ue.entry_date ASC, ue.created_at ASC`,
          [storeId, body.customerId],
        );

        let remaining = moneyNum(body.amount);
        let paymentId: string | null = null;

        for (const entry of openEntries) {
          if (remaining <= 0) break;
          const outstanding = dec(entry.amount).minus(dec(entry.paid_amount));
          const applied = moneyNum(dmin(remaining, outstanding));
          if (applied <= 0) continue;
          const allocated = await applyUdhaariPayment(tx, {
            entry,
            storeId,
            amount: applied,
            mode: body.mode,
            note,
            createdById: auth.id,
          });
          paymentId = allocated.id as string;
          remaining = moneyNum(dec(remaining).minus(applied));
        }

        // Anything not backed by an udhaari entry stays a plain advance
        // payment, exactly as before.
        if (remaining > 0 || paymentId == null) {
          const amount = paymentId == null ? moneyNum(body.amount) : remaining;
          const payment = await insertPayment(tx, {
            storeId,
            customerId: body.customerId,
            amount,
            type: "RECEIVED",
            mode: body.mode,
            referenceType: "CUSTOMER_PAYMENT",
            referenceId: body.customerId,
            note: body.note || null,
            createdById: auth.id,
          });
          paymentId = payment.id as string;
          await createLedgerEntry(tx, {
            customerId: body.customerId,
            storeId,
            type: "CREDIT",
            amount,
            referenceType: "PAYMENT",
            referenceId: paymentId,
            note,
          });
        }

        return { paymentId: paymentId as string };
      });

      logger.info("payment: received", { storeId, customerId: body.customerId, amount: body.amount });
      invalidateDashboardCache(storeId);
      const outstanding = await getCustomerOutstanding(qClient(), body.customerId);

      const smsInput = {
        storeId,
        customerId: body.customerId,
        customerMobile: (customer.mobile as string | null) ?? null,
        amount: body.amount,
        createdById: getAuth(request).id,
        paymentId: out.paymentId,
      };

      // Same contract as udhaari creation: device mode hands the ready-to-send
      // text back to the phone, every other mode stays fire-and-forget.
      let pendingSms: PendingSms | null = null;
      if (config.smsMode === "device") {
        pendingSms = await notifyUdhaariPayment(smsInput).catch((err) => {
          logger.error("sms: payment notify call failed", {
            storeId,
            paymentId: out.paymentId,
            error: String(err),
          });
          return null;
        });
      } else {
        void notifyUdhaariPayment(smsInput).catch((err) => {
          logger.error("sms: payment notify call failed", {
            storeId,
            paymentId: out.paymentId,
            error: String(err),
          });
        });
      }

      return reply.status(201).send({
        ok: true,
        balanceAfter: outstanding,
        outstanding,
        ...(pendingSms ? { pendingSms } : {}),
      });
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