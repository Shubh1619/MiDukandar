import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { lineItemSchema } from "../lib/schemas.js";
import { authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { createPurchase } from "../services/invoice.service.js";
import { insertPayment } from "../services/payment.service.js";
import { dec, dmax, money } from "../lib/money.js";
import { logger } from "../lib/logger.js";

const purchaseLineSchema = lineItemSchema;

const purchaseSchema = z.object({
  supplierName: z.string().min(1).max(150),
  supplierMobile: z.string().max(15).optional().default(""),
  lines: z.array(purchaseLineSchema).min(1),
  discount: z.coerce.number().min(0).optional().default(0),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(300).optional(),
});

export async function purchaseRoutes(app: FastifyInstance) {
  // List
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({ from: z.string().optional(), to: z.string().optional(), supplier: z.string().optional() }),
      request.query,
    );
    const conditions = ["store_id = $1"];
    const params: unknown[] = [storeId];
    if (query.from) { params.push(query.from); conditions.push(`created_at >= $${params.length}`); }
    if (query.to) { params.push(query.to); conditions.push(`created_at <= $${params.length}`); }
    if (query.supplier) { params.push(`%${query.supplier.toLowerCase()}%`); conditions.push(`lower(supplier_name) LIKE $${params.length}`); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const totalRow = await qOne<{ c: number }>(`SELECT COUNT(*) AS c FROM purchases ${where}`, params);
    const purchases = await q<Row>(
      `SELECT * FROM purchases ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return { total: Number(totalRow?.c ?? 0), page: query.page, limit: query.limit, purchases };
  });

  // Create (atomic transaction)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const body = parse(purchaseSchema, request.body);

      const purchase = await withTx(async (tx) =>
        createPurchase(tx, {
          storeId,
          supplierName: body.supplierName,
          supplierMobile: body.supplierMobile,
          lines: body.lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            qty: l.qty,
            unitPrice: l.unitPrice,
            gstPercent: l.gstPercent,
          })),
          discount: body.discount,
          paidAmount: body.paidAmount,
          notes: body.notes,
          createdById: getAuth(request).id,
        }),
      );

      logger.info("purchase: created", { storeId, purchaseId: purchase?.id, purchaseNumber: purchase?.purchase_number });
      return reply.status(201).send({ purchase });
    },
  );

  // Detail
  app.get("/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const purchase = await qOne<Row>(`SELECT * FROM purchases WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!purchase) throw ApiError.notFound("Purchase not found");
    const items = await q<Row>(`SELECT * FROM purchase_items WHERE purchase_id = $1`, [id]);
    return { purchase: { ...purchase, items } };
  });

  // Record payment against unpaid purchase
  app.post(
    "/:id/payment",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(
        z.object({
          amount: z.coerce.number().positive(),
          mode: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
          note: z.string().max(200).optional(),
        }),
        request.body,
      );
      await withTx(async (tx) => {
        // FOR UPDATE: the overpayment guard below reads paid_amount/total and
        // then writes new balances. Concurrent payments would each read the same
        // starting balance, each pass the guard, and together push paid_amount
        // past the purchase total.
        const purchase = await tx.qOne<Row>(
          `SELECT * FROM purchases WHERE id = $1 AND store_id = $2 FOR UPDATE`,
          [id, storeId],
        );
        if (!purchase) throw ApiError.notFound("Purchase not found");

        const newPaid = money(dec(purchase.paid_amount).plus(body.amount));
        if (newPaid.gt(dec(purchase.total))) {
          throw ApiError.badRequestCode("Payment exceeds purchase total.", "PAYMENT_EXCEEDS_TOTAL");
        }
        const due = money(dmax(0, dec(purchase.total).minus(newPaid)));
        await tx.q(
          `UPDATE purchases SET paid_amount = $1, due_amount = $2, payment_status = $3, updated_at = now()
           WHERE id = $4`,
          [newPaid.toNumber(), due.toNumber(), due.lte(0) ? "PAID" : "PARTIAL", id],
        );
        await insertPayment(tx, {
          storeId,
          amount: body.amount,
          type: "PAID",
          mode: body.mode,
          referenceType: "SUPPLIER_PAYMENT",
          referenceId: purchase.purchase_number as string,
          note: body.note ?? `Payment against ${purchase.purchase_number}`,
          createdById: getAuth(request).id,
        });
      });
      logger.info("purchase: payment recorded", { storeId, purchaseId: id, amount: body.amount });
      return { ok: true };
    },
  );
}