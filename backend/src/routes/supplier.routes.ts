import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { buildUpdate } from "../lib/db.js";
import { authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { logger } from "../lib/logger.js";
import { createPurchase, type PurchaseInput, type PurchaseRow } from "../services/invoice.service.js";

const supplierSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).optional().default(""),
  email: z.string().max(120).optional().default(""),
  gstin: z.string().max(30).optional().default(""),
  address: z.string().max(300).optional().default(""),
  category: z.string().max(60).optional().default(""),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.string().optional(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CHEQUE", "NEFT"]).default("CASH"),
  poId: z.string().optional(),
  note: z.string().max(300).optional().default(""),
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function getSupplierOutstandingSql(): string {
  return `COALESCE((
      SELECT SUM(po.total_amount) FROM purchase_orders po
      WHERE po.supplier_id = s.id AND po.status = 'received'
    ), 0) - COALESCE((
      SELECT SUM(sp.amount) FROM supplier_payments sp
      WHERE sp.supplier_id = s.id
    ), 0)`;
}

export async function supplierRoutes(app: FastifyInstance) {
  // Summary stats
  app.get("/summary", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const row = await qOne<Row>(
      `WITH s AS (
         SELECT s.id,
           COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po
                     WHERE po.supplier_id = s.id AND po.status = 'received'), 0) AS po_total,
           COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp
                     WHERE sp.supplier_id = s.id), 0) AS paid,
           EXISTS (SELECT 1 FROM purchase_orders po2
                   WHERE po2.supplier_id = s.id AND po2.status = 'received'
                     AND po2.expected_date IS NOT NULL AND po2.expected_date < CURRENT_DATE) AS has_overdue_po
         FROM suppliers s WHERE s.store_id = $1 AND NOT s.is_archived
       )
       SELECT COUNT(*)::int AS total,
              COALESCE(SUM(po_total - paid), 0) AS total_payable,
              COUNT(*) FILTER (WHERE (po_total - paid) > 0)::int AS outstanding_count,
              COUNT(*) FILTER (WHERE (po_total - paid) <= 0)::int AS settled_count,
              COUNT(*) FILTER (WHERE (po_total - paid) > 0 AND has_overdue_po)::int AS overdue_count
       FROM s`,
      [storeId],
    );
    return {
      total: Number(row?.total ?? 0),
      totalPayable: Number(row?.total_payable ?? 0),
      outstandingCount: Number(row?.outstanding_count ?? 0),
      settledCount: Number(row?.settled_count ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
      overdueDefinedAs: "received PO past expected_date with outstanding payable",
    };
  });

  // List
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({
        search: z.string().optional(),
        filter: z.enum(["all", "outstanding", "settled"]).default("all"),
      }),
      request.query,
    );
    const conditions = ["s.store_id = $1", "NOT s.is_archived"];
    const params: unknown[] = [storeId];
    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      conditions.push(`(lower(s.name) LIKE $${params.length} OR s.phone LIKE $${params.length})`);
    }
    if (query.filter === "outstanding") conditions.push(`(${getSupplierOutstandingSql()}) > 0`);
    if (query.filter === "settled") conditions.push(`(${getSupplierOutstandingSql()}) <= 0`);
    const where = `WHERE ${conditions.join(" AND ")}`;

    const totalRow = await qOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM suppliers s ${where}`,
      params,
    );
    const suppliers = await q<Row>(
      `SELECT s.*,
         COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po
                   WHERE po.supplier_id = s.id AND po.status = 'received'), 0) AS total_purchases,
         (${getSupplierOutstandingSql()}) AS outstanding_payable,
         (SELECT po.order_date FROM purchase_orders po
          WHERE po.supplier_id = s.id AND po.status <> 'cancelled'
          ORDER BY po.created_at DESC LIMIT 1) AS last_order_date,
         (SELECT COUNT(*) FROM purchase_orders po
          WHERE po.supplier_id = s.id AND po.status <> 'cancelled')::int AS active_po_count
       FROM suppliers s ${where}
       ORDER BY s.name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return {
      total: Number(totalRow?.c ?? 0),
      page: query.page,
      limit: query.limit,
      suppliers,
    };
  });

  // Create
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const body = parse(supplierSchema, request.body);
      const supplier = await qOne<Row>(
        `INSERT INTO suppliers (store_id, name, phone, email, gstin, address, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [storeId, body.name, body.phone, body.email, body.gstin, body.address, body.category],
      );
      logger.info("supplier: created", { storeId, supplierId: supplier?.id, by: getAuth(request).id });
      return reply.status(201).send({ supplier });
    },
  );

  // Detail: info + PO history + payments + outstanding
  app.get("/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const supplier = await qOne<Row>(
      `SELECT s.*,
         COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po
                   WHERE po.supplier_id = s.id AND po.status = 'received'), 0) AS total_purchases,
         (${getSupplierOutstandingSql()}) AS outstanding_payable
       FROM suppliers s WHERE s.id = $1 AND s.store_id = $2`,
      [id, storeId],
    );
    if (!supplier) throw ApiError.notFound("Supplier not found");

    const [pos, payments] = await Promise.all([
      q<Row>(
        `SELECT po.id, po.po_number, po.status, po.order_date, po.expected_date, po.total_amount,
                po.created_at,
                (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id)::int AS item_count
         FROM purchase_orders po
         WHERE po.supplier_id = $1 AND po.store_id = $2
         ORDER BY po.created_at DESC LIMIT 100`,
        [id, storeId],
      ),
      q<Row>(
        `SELECT sp.*, po.po_number
         FROM supplier_payments sp
         LEFT JOIN purchase_orders po ON po.id = sp.po_id
         WHERE sp.supplier_id = $1 AND sp.store_id = $2
         ORDER BY sp.payment_date DESC, sp.created_at DESC LIMIT 100`,
        [id, storeId],
      ),
    ]);
    return { supplier, purchaseOrders: pos, payments };
  });

  // Update
  app.patch(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(supplierSchema.partial(), request.body);
      const existing = await qOne<Row>(`SELECT id FROM suppliers WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!existing) throw ApiError.notFound("Supplier not found");

      const entries: Array<[string, unknown]> = [];
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined) continue;
        entries.push([k, v === "" ? null : v]);
      }
      const update = buildUpdate("suppliers", entries, { id, storeId });
      if (!update) return { supplier: existing };
      const supplier = await qOne<Row>(update.sql, update.params);
      return { supplier };
    },
  );

  // Delete (soft delete; blocked while any non-cancelled PO exists)
  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const existing = await qOne<Row>(`SELECT id, name, is_archived FROM suppliers WHERE id = $1 AND store_id = $2`, [
        id,
        storeId,
      ]);
      if (!existing) throw ApiError.notFound("Supplier not found");
      if (existing.is_archived) return reply.send({ ok: true });

      const activePo = await qOne<{ c: number }>(
        `SELECT COUNT(*) AS c FROM purchase_orders po
         WHERE po.supplier_id = $1 AND po.store_id = $2 AND po.status <> 'cancelled'`,
        [id, storeId],
      );
      if ((activePo?.c ?? 0) > 0) {
        throw ApiError.conflictCode(
          "Supplier has purchase orders. Cancel open orders before deleting.",
          "SUPPLIER_HAS_ACTIVE_POS",
        );
      }

      await qOne<Row>(`UPDATE suppliers SET is_archived = TRUE, updated_at = now() WHERE id = $1 AND store_id = $2`, [
        id,
        storeId,
      ]);
      logger.info("supplier: archived", { storeId, supplierId: id, name: existing.name, by: getAuth(request).id });
      return reply.send({ ok: true });
    },
  );

  // Record payment (reduces outstanding payable)
  app.post(
    "/:id/payments",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(paymentSchema, request.body);

      await withTx(async (tx) => {
        const supplier = await tx.qOne<Row>(
          `SELECT id FROM suppliers WHERE id = $1 AND store_id = $2 AND NOT is_archived`,
          [id, storeId],
        );
        if (!supplier) throw ApiError.notFound("Supplier not found");

        if (body.poId) {
          const po = await tx.qOne<Row>(
            `SELECT id FROM purchase_orders WHERE id = $1 AND store_id = $2 AND supplier_id = $3`,
            [body.poId, storeId, id],
          );
          if (!po) throw ApiError.badRequestCode("PO does not belong to this supplier.", "PO_NOT_FOUND");
        }

        const bal = await tx.qOne<Row>(
          `SELECT
             COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po
                       WHERE po.supplier_id = $1 AND po.status = 'received'), 0)
             - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = $1), 0) AS outstanding`,
          [id],
        );
        const outstanding = Number(bal?.outstanding ?? 0);
        if (body.amount > round2(outstanding)) {
          throw ApiError.badRequestCode(
            `Payment of ${body.amount} exceeds outstanding payable of ${outstanding.toFixed(2)}.`,
            "PAYMENT_EXCEEDS_OUTSTANDING",
          );
        }

        await tx.q(
          `INSERT INTO supplier_payments (store_id, supplier_id, po_id, amount, payment_date, payment_mode, note, created_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            storeId,
            id,
            body.poId ? body.poId : null,
            String(body.amount),
            body.paymentDate || new Date().toISOString().slice(0, 10),
            body.paymentMode,
            body.note ?? "",
            getAuth(request).id,
          ],
        );
      });
      logger.info("supplier: payment recorded", { storeId, supplierId: id, amount: body.amount });
      return reply.status(201).send({ ok: true });
    },
  );

  // Payment history
  app.get("/:id/payments", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const supplier = await qOne<Row>(`SELECT id FROM suppliers WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!supplier) throw ApiError.notFound("Supplier not found");
    const payments = await q<Row>(
      `SELECT sp.*, po.po_number
       FROM supplier_payments sp
       LEFT JOIN purchase_orders po ON po.id = sp.po_id
       WHERE sp.supplier_id = $1 AND sp.store_id = $2
       ORDER BY sp.payment_date DESC, sp.created_at DESC LIMIT 200`,
      [id, storeId],
    );
    return { payments };
  });

  // Create invoice (supplier purchase with invoice number)
  app.post(
    "/:id/invoice",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const supplier = await qOne<Row>(`SELECT id, name FROM suppliers WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!supplier) throw ApiError.notFound("Supplier not found");

      const body = request.body as {
        supplierMobile?: string;
        lines: { productId?: string; productName?: string; qty: number; unitPrice?: number; gstPercent?: number }[];
        discount?: number;
        paidAmount?: number;
        notes?: string;
      };

      if (!body.lines || body.lines.length === 0) {
        throw ApiError.badRequestCode("Purchase must have at least one line item.", "EMPTY_PURCHASE");
      }

      // Validate products exist in this store using withTx
      const productIds = [...new Set(body.lines.filter((l) => l.productId).map((l) => l.productId as string))];
      if (productIds.length > 0) {
        let products: Array<{ id: string; name: string; barcode: string | null; purchase_price: number; gst_percent: number; store_id: string }> = [];
        await withTx(async (tx) => {
          products = (await tx.q<{
            id: string; name: string; barcode: string | null; purchase_price: number; gst_percent: number; store_id: string;
          }>(`SELECT id, name, barcode, purchase_price, gst_percent, store_id FROM products WHERE id = ANY($1::uuid[]) AND store_id = $2`, [productIds, storeId])) as Array<{
            id: string; name: string; barcode: string | null; purchase_price: number; gst_percent: number; store_id: string;
          }>;
          if (products.length !== productIds.length) {
            throw ApiError.badRequestCode("One or more products are invalid or belong to another store.", "INVALID_PRODUCT");
          }
          for (const p of products) {
            if (p.store_id !== storeId) {
              throw ApiError.badRequestCode("One or more products belong to another store.", "INVALID_PRODUCT");
            }
          }
        });
      }

      const input: PurchaseInput = {
        storeId,
        supplierName: supplier.name as string,
        supplierMobile: body.supplierMobile,
        lines: body.lines.map((l) => ({
          productId: l.productId ?? null,
          productName: l.productName?.trim() || undefined,
          qty: l.qty,
          unitPrice: l.unitPrice ?? 0,
          gstPercent: l.gstPercent ?? 0,
        })),
        discount: body.discount ?? 0,
        paidAmount: body.paidAmount ?? 0,
        notes: body.notes,
        createdById: getAuth(request).id,
      };

      const purchase = await withTx(async (tx) => createPurchase(tx, input));
      return reply.status(201).send({ purchase });
    }
  );

  // Payment history

  // Reorder message (WhatsApp deep link from latest non-cancelled PO)
  app.get("/:id/reorder-message", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const supplier = await qOne<Row>(`SELECT id, name, phone FROM suppliers WHERE id = $1 AND store_id = $2`, [
      id,
      storeId,
    ]);
    if (!supplier) throw ApiError.notFound("Supplier not found");

    const lastPo = await qOne<Row>(
      `SELECT id, po_number, status FROM purchase_orders
       WHERE supplier_id = $1 AND store_id = $2 AND status <> 'cancelled'
       ORDER BY created_at DESC LIMIT 1`,
      [id, storeId],
    );
    if (!lastPo) {
      return { message: "", waLink: null, hasPo: false, phone: supplier.phone };
    }

    const items = await q<Row>(
      `SELECT i.quantity, i.rate, p.name
       FROM purchase_order_items i
       JOIN products p ON p.id = i.product_id
       WHERE i.po_id = $1
       ORDER BY p.name ASC`,
      [lastPo.id as string],
    );

    const lines = items.map((i) => `• ${i.name} x ${Number(i.quantity).toLocaleString("en-IN")}`);
    const message =
      lines.length > 0 ? `Re-order for ${supplier.name}\nLast PO ${lastPo.po_number}\n${lines.join("\n")}` : "";

    const digits = String(supplier.phone ?? "").replace(/[^\d]/g, "");
    const waLink = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
    return { message, phone: supplier.phone, waLink, hasPo: true };
  });
}