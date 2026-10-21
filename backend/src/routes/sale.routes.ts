import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { lineItemBaseSchema, requireLineName } from "../lib/schemas.js";
import { authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { createSale, reverseSale, updateSale, recordSalePayment } from "../services/invoice.service.js";
import { generateInvoicePdf } from "../lib/pdf.js";
import { logger } from "../lib/logger.js";
import { invalidateDashboardCache } from "../lib/dashboard-cache.js";

const saleLineSchema = lineItemBaseSchema
  .extend({
    discount: z.coerce.number().min(0).optional().default(0),
  })
  .refine(requireLineName, { message: "Either productId or productName is required" });

const saleCustomerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  gst: z.string().max(20).optional(),
});

const saleSchema = z.object({
  customerId: z.string().optional(),
  /** Free-entry new customer to auto-create when `customerId` is absent. */
  customer: saleCustomerSchema.optional(),
  /** Udhaar (CREDIT) metadata: expected payment + reminder dates. */
  udhaar: z.object({
    dueDate: z.string().optional(),
    reminderDate: z.string().optional(),
  }).optional(),
  lines: z.array(saleLineSchema).min(1),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
  discount: z.coerce.number().min(0).optional().default(0),
  discountType: z.enum(["FLAT", "PERCENT"]).optional().default("FLAT"),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(300).optional(),
});

/**
 * Edit schema. A partial edit may omit `lines`, `paymentMode`, `paidAmount`,
 * `discount` and `notes`: `updateSale` then preserves each stored value instead
 * of clearing it. When `lines` *is* supplied the whole sale is re-priced,
 * matching the create contract.
 */
const saleUpdateSchema = saleSchema.extend({
  lines: z.array(saleLineSchema).min(1).optional(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).optional(),
  discount: z.coerce.number().min(0).optional(),
  discountType: z.enum(["FLAT", "PERCENT"]).optional(),
});

/** Credit invoices outstanding longer than this many days count as overdue. */
const OVERDUE_DAYS = 30;

/** pg returns `date` columns as JS Date; normalize to YYYY-MM-DD for payloads. */
function toYmd(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const heldBillSchema = z.object({
  label: z.string().max(80).optional(),
  payload: z.record(z.unknown()),
});

export async function saleRoutes(app: FastifyInstance) {
  // List sales
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({
        from: z.string().optional(),
        to: z.string().optional(),
        customerId: z.string().optional(),
        status: z.enum(["HELD", "CONFIRMED", "CANCELED", "REVERSED"]).optional(),
        paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).optional(),
        payment: z.enum(["PAID", "UNPAID", "OVERDUE"]).optional(),
        search: z.string().optional(),
      }),
      request.query,
    );
    const { conditions, params } = salesWhere(storeId, query);
    const total = await countSales(storeId, conditions, params);
    const sales = await q<Row>(
      `SELECT s.*, c.name AS customer_name, c.mobile AS customer_mobile
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const summary = await salesSummary(storeId, conditions, params);

    return {
      total,
      page: query.page,
      limit: query.limit,
      sales,
      summary: {
        totalInvoices: Number(summary?.total_invoices ?? 0),
        totalRevenue: Number(summary?.total_revenue ?? 0),
        pendingAmount: Number(summary?.pending_amount ?? 0),
        overdueCount: Number(summary?.overdue_count ?? 0),
      },
    };
  });

  // Create confirmed sale (atomic transaction)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const body = parse(saleSchema, request.body);

      const sale = await withTx(async (tx) =>
        createSale(tx, {
          storeId,
          customerId: body.customerId,
          customer: body.customer,
          udhaar: body.udhaar,
          lines: body.lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discount: l.discount,
            gstPercent: l.gstPercent,
          })),
          paymentMode: body.paymentMode,
          discount: body.discount,
          discountType: body.discountType,
          paidAmount: body.paidAmount,
          notes: body.notes,
          createdById: getAuth(request).id,
        }),
      );

      logger.info("sale: created", { storeId, saleId: sale?.id, invoiceNumber: sale?.invoice_number, by: getAuth(request).id });
      invalidateDashboardCache(storeId);
      return reply.status(201).send({ sale });
    },
  );

  // Update (edit) a confirmed sale — same body as create, keeps invoice number.
  app.put(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(saleUpdateSchema, request.body);
      const sale = await withTx(async (tx) =>
        updateSale(tx, storeId, id, {
          storeId,
          customerId: body.customerId,
          customer: body.customer,
          udhaar: body.udhaar,
          lines: body.lines?.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discount: l.discount,
            gstPercent: l.gstPercent,
          })),
          paymentMode: body.paymentMode,
          discount: body.discount,
          discountType: body.discountType,
          paidAmount: body.paidAmount,
          notes: body.notes,
          createdById: getAuth(request).id,
        }),
      );
      logger.info("sale: updated", { storeId, saleId: id, invoiceNumber: sale?.invoice_number, by: getAuth(request).id });
      invalidateDashboardCache(storeId);
      return { sale };
    },
  );

  // Record a payment against a confirmed sale (full or partial settlement).
  app.post(
    "/:id/pay",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.CASHIER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(
        z.object({
          amount: z.coerce.number().positive(),
          mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
          note: z.string().max(300).optional(),
        }),
        request.body,
      );
      const sale = await withTx(async (tx) =>
        recordSalePayment(tx, storeId, id, getAuth(request).id, {
          amount: body.amount,
          mode: body.mode,
          note: body.note,
        }),
      );
      logger.info("sale: payment recorded", { storeId, saleId: id, invoiceNumber: sale?.invoice_number, amount: body.amount, by: getAuth(request).id });
      invalidateDashboardCache(storeId);
      return { sale };
    },
  );

  // Sale detail
  app.get("/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const sale = await qOne<Row>(`SELECT * FROM sales WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!sale) throw ApiError.notFound("Sale not found");
    const [items, customer] = await Promise.all([
      q<Row>(`SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id`, [id]),
      sale.customer_id
        ? qOne<Row>(`SELECT id, name, mobile, address FROM customers WHERE id = $1`, [sale.customer_id])
        : Promise.resolve(null),
    ]);
    return { sale: { ...sale, items, customer } };
  });

  // Invoice data
  app.get("/:id/invoice", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const sale = await qOne<Row>(`SELECT * FROM sales WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!sale) throw ApiError.notFound("Sale not found");
    const [items, store, customer] = await Promise.all([
      q<Row>(`SELECT * FROM sale_items WHERE sale_id = $1`, [id]),
      qOne<Row>(`SELECT name, type, address, phone, gst FROM stores WHERE id = $1`, [storeId]),
      sale.customer_id
        ? qOne<Row>(`SELECT name, mobile, address FROM customers WHERE id = $1`, [sale.customer_id])
        : Promise.resolve(null),
    ]);

    const invoice = {
      invoiceNumber: sale.invoice_number,
      date: sale.created_at,
      store: store && {
        name: store.name,
        type: store.type,
        address: store.address,
        phone: store.phone,
        gst: store.gst,
      },
      customer: customer && { name: customer.name, mobile: customer.mobile, address: customer.address },
      items: items.map((i) => ({
        name: i.product_name, qty: Number(i.qty), price: Number(i.unit_price), gst: Number(i.gst_percent),
        tax: Number(i.tax_amount), amount: Number(i.line_total),
      })),
      subtotal: Number(sale.subtotal), discount: Number(sale.discount), tax: Number(sale.tax_total),
      total: Number(sale.total), paid: Number(sale.paid_amount), due: Number(sale.due_amount),
      paymentMode: sale.payment_mode, notes: sale.notes, status: sale.status,
      dueDate: sale.due_date ? (toYmd(new Date(String(sale.due_date))) ?? undefined) : undefined,
    };
    return { invoice };
  });

  // PDF download
  app.get("/:id/invoice/pdf", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const sale = await qOne<Row>(`SELECT * FROM sales WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!sale) throw ApiError.notFound("Sale not found");
    const [items, store, customer] = await Promise.all([
      q<Row>(`SELECT * FROM sale_items WHERE sale_id = $1`, [id]),
      qOne<Row>(`SELECT * FROM stores WHERE id = $1`, [storeId]),
      sale.customer_id ? qOne<Row>(`SELECT id, name, mobile, address FROM customers WHERE id = $1`, [sale.customer_id]) : Promise.resolve(null),
    ]);
    if (!store) throw ApiError.notFound("Store not found");

    const buf = await generateInvoicePdf({
      storeName: store.name as string,
      storeType: (store.type as string) ?? undefined,
      storeAddress: (store.address as string) ?? undefined,
      storePhone: (store.phone as string) ?? undefined,
      storeGst: (store.gst as string) ?? undefined,
      invoiceNumber: sale.invoice_number as string,
      date: String((sale.created_at as Date).toLocaleDateString("en-IN")),
      customerName: (customer?.name as string) ?? "Walk-in Customer",
      customerMobile: (customer?.mobile as string) ?? undefined,
      customerAddress: (customer?.address as string) ?? undefined,
      items: items.map((i) => ({
        name: i.product_name as string,
        qty: Number(i.qty).toString(),
        price: `₹${Number(i.unit_price).toFixed(2)}`,
        amount: `₹${Number(i.line_total).toFixed(2)}`,
      })),
      subtotal: `₹${Number(sale.subtotal).toFixed(2)}`,
      discount: `₹${Number(sale.discount).toFixed(2)}`,
      tax: `₹${Number(sale.tax_total).toFixed(2)}`,
      total: Number(sale.total).toFixed(2),
      paid: Number(sale.paid_amount).toFixed(2),
      due: Number(sale.due_amount).toFixed(2),
      paymentMode: sale.payment_mode as string,
      notes: (sale.notes as string) ?? undefined,
      dueDate: sale.due_date ? (toYmd(new Date(String(sale.due_date))) ?? undefined) : undefined,
    });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${sale.invoice_number}.pdf"`);
    return reply.send(buf);
  });

  // Reverse a confirmed sale
  app.post(
    "/:id/reverse",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(z.object({ reason: z.string().min(2).max(300) }), request.body);
      await withTx(async (tx) => {
        await reverseSale(tx, storeId, id, body.reason, getAuth(request).id);
      });
      logger.info("sale: reversed", { storeId, saleId: id, reason: body.reason });
      return { ok: true };
    },
  );

  // ---- Hold a bill ----
  app.post(
    "/hold",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const body = parse(heldBillSchema, request.body);
      const billNumber = body.label?.trim() ? body.label.trim() : `HLD-${Date.now()}`;
      const [held] = await q<Row>(
        `INSERT INTO held_bills (store_id, bill_number, payload, created_by_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [storeId, billNumber, JSON.stringify(body.payload), getAuth(request).id],
      );
      return reply.status(201).send({ heldBill: held });
    },
  );

  // ---- List held bills ----
  app.get("/held/list", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const held = await q<Row>(
      `SELECT * FROM held_bills WHERE store_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [storeId],
    );
    return { heldBills: held };
  });

  // ---- Fetch a held bill ----
  app.get("/held/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const held = await qOne<Row>(`SELECT * FROM held_bills WHERE id = $1 AND store_id = $2`, [id, storeId]);
    if (!held) throw ApiError.notFound("Held bill not found");
    return { heldBill: held };
  });

  // ---- Delete a held bill ----
  app.delete("/held/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    await qOne<Row>(`DELETE FROM held_bills WHERE id = $1 AND store_id = $2`, [id, storeId]);
    return { ok: true };
  });
}

function salesWhere(
  storeId: string,
  query: {
    from?: string; to?: string; customerId?: string; status?: string; paymentMode?: string; payment?: "PAID" | "UNPAID" | "OVERDUE"; search?: string;
  },
): { conditions: string[]; params: unknown[] } {
  const conditions = ["s.store_id = $1"];
  const params: unknown[] = [storeId];
  if (query.from) { params.push(query.from); conditions.push(`s.created_at >= $${params.length}`); }
  if (query.to) { params.push(query.to); conditions.push(`s.created_at <= $${params.length}`); }
  if (query.customerId) { params.push(query.customerId); conditions.push(`s.customer_id = $${params.length}`); }
  if (query.status) { params.push(query.status); conditions.push(`s.status = $${params.length}`); }
  if (query.paymentMode) { params.push(query.paymentMode); conditions.push(`s.payment_mode = $${params.length}`); }
  if (query.payment === "PAID") conditions.push(`s.status = 'CONFIRMED' AND s.due_amount <= 0`);
  if (query.payment === "UNPAID") conditions.push(`s.status = 'CONFIRMED' AND s.due_amount > 0`);
  if (query.payment === "OVERDUE") {
    conditions.push(
      `s.status = 'CONFIRMED' AND s.due_amount > 0 AND s.created_at < now() - make_interval(days => ${OVERDUE_DAYS})`,
    );
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    conditions.push(
      `(s.invoice_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.mobile ILIKE $${params.length} OR s.total::text ILIKE $${params.length} OR s.due_amount::text ILIKE $${params.length})`,
    );
  }
  return { conditions, params };
}

async function countSales(
  storeId: string,
  conditions: string[],
  params: unknown[],
): Promise<number> {
  const row = await qOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${conditions.join(" AND ")}`,
    params,
  );
  return Number(row?.c ?? 0);
}

/** Aggregates totals over the same filter the list uses (for the summary bar). */
async function salesSummary(
  storeId: string,
  conditions: string[],
  params: unknown[],
): Promise<{ total_invoices: number; total_revenue: number; pending_amount: number; overdue_count: number } | null> {
  return qOne<{ total_invoices: number; total_revenue: number; pending_amount: number; overdue_count: number }>(
    `SELECT
       COUNT(*) AS total_invoices,
       COALESCE(SUM(CASE WHEN s.status <> 'REVERSED' THEN s.paid_amount ELSE 0 END), 0) AS total_revenue,
       COALESCE(SUM(CASE WHEN s.status = 'CONFIRMED' AND s.due_amount > 0 THEN s.due_amount ELSE 0 END), 0) AS pending_amount,
       COUNT(*) FILTER (WHERE s.status = 'CONFIRMED' AND s.due_amount > 0 AND s.created_at < now() - make_interval(days => ${OVERDUE_DAYS})) AS overdue_count
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE ${conditions.join(" AND ")}`,
    params,
  );
}