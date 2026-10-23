import { z } from "zod";
import { q, qOne, withTx } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, requireRole, getAuth } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { createStockMovement } from "../services/stock.service.js";
import { logger } from "../lib/logger.js";
const poLineSchema = z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().positive(),
    rate: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(0),
});
const poSchema = z.object({
    supplierId: z.string().min(1),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(["draft", "sent"]).default("draft"),
    lines: z.array(poLineSchema).min(1),
});
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function lineToRs(item) {
    const qty = Number(item.quantity);
    const rate = Number(item.rate);
    const taxRate = Number(item.taxRate);
    const gross = qty * rate;
    const lineTotal = round2(gross + (gross * taxRate) / 100);
    return { lineTotal, qty: String(qty), rate: String(rate) };
}
async function nextPoNumber(tx, storeId) {
    const rows = await tx.q(`SELECT po_number FROM purchase_orders WHERE store_id = $1`, [storeId]);
    let maxSeq = 0;
    for (const row of rows) {
        const match = /^PO-(\d+)$/.exec(String(row.po_number));
        if (match)
            maxSeq = Math.max(maxSeq, Number(match[1]));
    }
    return `PO-${String(maxSeq + 1).padStart(4, "0")}`;
}
export async function purchaseOrderRoutes(app) {
    // List with filters
    app.get("/", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const query = parse(paginationSchema.extend({
            supplierId: z.string().optional(),
            status: z.enum(["draft", "sent", "received", "cancelled"]).optional(),
            from: z.string().optional(),
            to: z.string().optional(),
        }), request.query);
        const conditions = ["po.store_id = $1"];
        const params = [storeId];
        if (query.supplierId) {
            params.push(query.supplierId);
            conditions.push(`po.supplier_id = $${params.length}`);
        }
        if (query.status) {
            params.push(query.status);
            conditions.push(`po.status = $${params.length}`);
        }
        if (query.from) {
            params.push(query.from);
            conditions.push(`po.order_date >= $${params.length}`);
        }
        if (query.to) {
            params.push(query.to);
            conditions.push(`po.order_date <= $${params.length}`);
        }
        const where = `WHERE ${conditions.join(" AND ")}`;
        const totalRow = await qOne(`SELECT COUNT(*) AS c FROM purchase_orders po ${where}`, params);
        const pos = await q(`SELECT po.*, s.name AS supplier_name,
              (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id)::int AS item_count
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, query.limit, (query.page - 1) * query.limit]);
        const now = new Date();
        const rows = pos.map((po) => ({
            ...po,
            isOverdue: po.status === "received" && !!po.expected_date && new Date(po.expected_date) < now,
        }));
        return { total: Number(totalRow?.c ?? 0), page: query.page, limit: query.limit, purchaseOrders: rows };
    });
    // Create
    app.post("/", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request, reply) => {
        const storeId = requireStore(request);
        const userId = getAuth(request).id;
        const body = parse(poSchema, request.body);
        const purchaseOrder = await withTx(async (tx) => {
            const supplier = await tx.qOne(`SELECT id FROM suppliers WHERE id = $1 AND store_id = $2 AND NOT is_archived`, [body.supplierId, storeId]);
            if (!supplier)
                throw ApiError.notFoundCode("Supplier not found.", "SUPPLIER_NOT_FOUND");
            const products = await tx.q(`SELECT id FROM products WHERE store_id = $1 AND id = ANY($2::uuid[])`, [storeId, body.lines.map((l) => l.productId)]);
            const knownProducts = new Set(products.map((p) => p.id));
            if (body.lines.some((l) => !knownProducts.has(l.productId))) {
                throw ApiError.badRequestCode("One or more products are not in this store.", "PRODUCT_NOT_FOUND");
            }
            await tx.q(`SELECT id FROM stores WHERE id = $1 FOR UPDATE`, [storeId]);
            const poNumber = await nextPoNumber(tx, storeId);
            const totals = body.lines.map((l) => lineToRs(l));
            const totalAmount = round2(totals.reduce((acc, t) => acc + t.lineTotal, 0));
            const po = await tx.qOne(`INSERT INTO purchase_orders
             (store_id, supplier_id, po_number, status, order_date, expected_date, total_amount, created_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [
                storeId,
                body.supplierId,
                poNumber,
                body.status,
                body.orderDate ?? new Date().toISOString().slice(0, 10),
                body.expectedDate ? body.expectedDate : null,
                String(totalAmount),
                userId,
            ]);
            for (let i = 0; i < body.lines.length; i++) {
                const line = body.lines[i];
                const t = totals[i];
                await tx.q(`INSERT INTO purchase_order_items (po_id, product_id, quantity, rate, tax_rate, line_total)
             VALUES ($1, $2, $3, $4, $5, $6)`, [po?.id, line.productId, t.qty, t.rate, String(line.taxRate), String(t.lineTotal)]);
            }
            return po;
        });
        logger.info("purchase-order: created", { storeId, poId: purchaseOrder?.id, poNumber: purchaseOrder?.po_number });
        return reply.status(201).send({ purchaseOrder });
    });
    // Detail
    app.get("/:id", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const po = await qOne(`SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1 AND po.store_id = $2`, [id, storeId]);
        if (!po)
            throw ApiError.notFound("Purchase order not found");
        const items = await q(`SELECT i.*, p.name, p.barcode
       FROM purchase_order_items i JOIN products p ON p.id = i.product_id
       WHERE i.po_id = $1 ORDER BY p.name ASC`, [id]);
        return { purchaseOrder: { ...po, items } };
    });
    // Edit (draft only) - replaces line items atomically
    app.patch("/:id", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const body = parse(poSchema.partial(), request.body);
        const purchaseOrder = await withTx(async (tx) => {
            const existing = await tx.qOne(`SELECT id FROM purchase_orders WHERE id = $1 AND store_id = $2`, [id, storeId]);
            if (!existing)
                throw ApiError.notFound("Purchase order not found");
            const current = await tx.qOne(`SELECT status FROM purchase_orders WHERE id = $1`, [id]);
            if (current?.status !== "draft") {
                throw ApiError.conflictCode("Only draft POs can be edited.", "PO_NOT_DRAFT");
            }
            let supplierId = current && (await tx.qOne(`SELECT supplier_id FROM purchase_orders WHERE id = $1`, [id]))?.supplier_id;
            if (body.supplierId) {
                const supplier = await tx.qOne(`SELECT id FROM suppliers WHERE id = $1 AND store_id = $2 AND NOT is_archived`, [body.supplierId, storeId]);
                if (!supplier)
                    throw ApiError.notFoundCode("Supplier not found.", "SUPPLIER_NOT_FOUND");
                supplierId = body.supplierId;
            }
            let lines = null;
            if (body.lines) {
                const products = await tx.q(`SELECT id FROM products WHERE store_id = $1 AND id = ANY($2::uuid[])`, [storeId, body.lines.map((l) => l.productId)]);
                const knownProducts = new Set(products.map((p) => p.id));
                if (body.lines.some((l) => !knownProducts.has(l.productId))) {
                    throw ApiError.badRequestCode("One or more products are not in this store.", "PRODUCT_NOT_FOUND");
                }
                lines = body.lines;
            }
            const totals = lines ? lines.map((l) => lineToRs(l)) : null;
            const totalAmount = totals ? round2(totals.reduce((acc, t) => acc + t.lineTotal, 0)) : undefined;
            const upd = await tx.qOne(`UPDATE purchase_orders
           SET supplier_id = COALESCE($1, supplier_id),
               order_date = COALESCE($2, order_date),
               expected_date = CASE WHEN $3::date IS NULL THEN expected_date ELSE $3::date END,
               total_amount = COALESCE($4, total_amount),
               updated_at = now()
           WHERE id = $5 RETURNING *, (SELECT name FROM suppliers WHERE id = supplier_id) AS supplier_name`, [
                supplierId ?? null,
                body.orderDate ?? null,
                body.expectedDate ? body.expectedDate : null,
                totalAmount !== undefined ? String(totalAmount) : null,
                id,
            ]);
            if (lines) {
                await tx.q(`DELETE FROM purchase_order_items WHERE po_id = $1`, [id]);
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const t = totals[i];
                    await tx.q(`INSERT INTO purchase_order_items (po_id, product_id, quantity, rate, tax_rate, line_total)
               VALUES ($1, $2, $3, $4, $5, $6)`, [id, line.productId, t.qty, t.rate, String(line.taxRate), String(t.lineTotal)]);
                }
            }
            return upd;
        });
        return { purchaseOrder };
    });
    // Status change; receive() appends stock movements atomically (idempotent)
    app.patch("/:id/status", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const body = parse(z.object({
            status: z.enum(["sent", "received", "cancelled"]),
            expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }), request.body);
        const po = await withTx(async (tx) => {
            const current = await tx.qOne(`SELECT * FROM purchase_orders WHERE id = $1 AND store_id = $2 FOR UPDATE`, [id, storeId]);
            if (!current)
                throw ApiError.notFound("Purchase order not found");
            const allowed = {
                draft: ["sent", "received", "cancelled"],
                sent: ["received", "cancelled"],
                received: [],
                cancelled: [],
            };
            if (!allowed[current.status].includes(body.status)) {
                throw ApiError.conflictCode(`Cannot change PO status from "${current.status}" to "${body.status}".`, "INVALID_STATUS_TRANSITION");
            }
            if (body.status === "received") {
                await tx.q(`DELETE FROM stock_movements WHERE reference_type = 'PURCHASE_ORDER' AND reference_id = $1`, [id]);
                const items = await tx.q(`SELECT * FROM purchase_order_items WHERE po_id = $1`, [id]);
                for (const item of items) {
                    await createStockMovement(tx, {
                        productId: item.product_id,
                        storeId,
                        qty: Number(item.quantity),
                        type: "PURCHASE",
                        referenceType: "PURCHASE_ORDER",
                        referenceId: id,
                        note: `PO ${current.po_number}`,
                        createdById: getAuth(request).id,
                    });
                }
            }
            const expectedDate = body.status === "sent" && body.expectedDate ? body.expectedDate : current.expected_date;
            const upd = await tx.qOne(`UPDATE purchase_orders SET status = $1, expected_date = $2, updated_at = now() WHERE id = $3 RETURNING *`, [body.status, expectedDate ?? null, id]);
            logger.info("purchase-order: status changed", {
                storeId,
                poId: id,
                from: current.status,
                to: body.status,
                by: getAuth(request).id,
            });
            return upd;
        });
        return { purchaseOrder: po };
    });
    // Delete (draft or cancelled only)
    app.delete("/:id", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request, reply) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const po = await qOne(`SELECT id, status FROM purchase_orders WHERE id = $1 AND store_id = $2`, [
            id,
            storeId,
        ]);
        if (!po)
            throw ApiError.notFound("Purchase order not found");
        if (po.status !== "draft" && po.status !== "cancelled") {
            throw ApiError.conflictCode("Only draft or cancelled POs can be deleted.", "PO_CANNOT_DELETE");
        }
        await q(`DELETE FROM purchase_orders WHERE id = $1`, [id]);
        return reply.send({ ok: true });
    });
}
