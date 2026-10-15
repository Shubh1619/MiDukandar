import { z } from "zod";
import { q, qOne, withTx } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, getAuth } from "../middlewares/auth.js";
import { createLedgerEntry } from "../services/ledger.service.js";
import { insertPayment } from "../services/payment.service.js";
import { dec, money } from "../lib/money.js";
import { logger } from "../lib/logger.js";
export function entryStatus(paid, amount) {
    if (paid >= amount)
        return "PAID";
    if (paid > 0)
        return "PARTIAL";
    return "PENDING";
}
/** pg returns `date` columns as JS Date; normalize to YYYY-MM-DD for string comparisons and JSON. */
function toYmd(v) {
    if (!v)
        return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime()))
        return null;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}
/** Records a udhaari payment: udhaari_payments row + payments row + ledger CREDIT. Runs inside a tx. */
async function applyUdhaariPayment(tx, input) {
    const payment = await tx.qOne(`INSERT INTO udhaari_payments (store_id, udhaari_entry_id, amount, mode, note, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`, [
        input.storeId,
        input.entry.id,
        String(input.amount),
        input.mode,
        input.note ?? null,
        input.createdById,
    ]);
    if (!payment)
        throw new Error("Udhaari payment insert failed");
    await insertPayment(tx, {
        storeId: input.storeId,
        customerId: input.entry.customer_id,
        amount: input.amount,
        type: "RECEIVED",
        mode: input.mode,
        referenceType: "UDHAARI_PAYMENT",
        referenceId: payment.id,
        note: input.note || "Udhaari payment received",
        createdById: input.createdById,
    });
    await createLedgerEntry(tx, {
        customerId: input.entry.customer_id,
        storeId: input.storeId,
        type: "CREDIT",
        amount: input.amount,
        referenceType: "UDHAARI_PAYMENT",
        referenceId: payment.id,
        note: input.note || "Udhaari payment received",
    });
    // When this is an invoice-linked udhaari entry, advance the sale's paid/due
    // amounts so the amount counts as revenue at the point of payment.
    if (input.entry.sale_id) {
        await tx.q(`UPDATE sales
          SET paid_amount = LEAST(paid_amount + $2, total),
              due_amount = GREATEST(due_amount - $2, 0),
              updated_at = now()
        WHERE id = $1 AND store_id = $3 AND status = 'CONFIRMED'`, [input.entry.sale_id, String(input.amount), input.storeId]);
    }
    return payment;
}
/** Resolves the udhaari customer: prefer the picked id, otherwise match by name (exact, case-insensitive)
 *  or create a new customer from the free-entry fields. */
async function resolveUdhaariCustomer(tx, storeId, input) {
    if (input.customerId) {
        const existing = await tx.qOne(`SELECT * FROM customers WHERE id = $1 AND store_id = $2`, [
            input.customerId,
            storeId,
        ]);
        if (!existing)
            throw ApiError.notFound("Customer not found");
        return existing;
    }
    const c = input.customer;
    if (!c || !c.name.trim())
        throw ApiError.badRequest("Customer name is required");
    const name = c.name.trim().replace(/\s+/g, " ");
    const matched = await tx.qOne(`SELECT * FROM customers WHERE store_id = $1 AND lower(name) = lower($2)
     ORDER BY created_at DESC LIMIT 1`, [storeId, name]);
    if (matched)
        return matched;
    const inserted = await tx.qOne(`INSERT INTO customers (store_id, name, mobile, address) VALUES ($1, $2, $3, $4) RETURNING *`, [storeId, name, c.mobile?.trim() || null, c.address?.trim() || null]);
    if (!inserted)
        throw new Error("Customer insert failed");
    return inserted;
}
export async function udhaariRoutes(app) {
    const createSchema = z
        .object({
        customerId: z.string().uuid().optional(),
        customer: z
            .object({
            name: z.string().min(1).max(150),
            mobile: z.string().max(20).optional(),
            address: z.string().max(300).optional(),
        })
            .optional(),
        amount: z.coerce.number().positive(),
        entryDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        dueDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        reminderDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        note: z.string().max(300).optional().default(""),
        status: z.enum(["PENDING", "PAID", "PARTIAL"]).optional().default("PENDING"),
        initialPaid: z.coerce.number().min(0).optional().default(0),
    })
        .refine((b) => Boolean(b.customerId ?? b.customer), {
        message: "Either customerId or customer is required",
        path: ["customer"],
    });
    const paySchema = z.object({
        amount: z.coerce.number().positive(),
        mode: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
        note: z.string().max(200).optional().default(""),
    });
    // Customer-level rollup (one row per customer that has any udhaari)
    app.get("/", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const query = parse(paginationSchema.extend({
            search: z.string().optional(),
            customerId: z.string().optional(),
            status: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
        }), request.query);
        const conditions = ["c.store_id = $1"];
        const params = [storeId];
        const having = [];
        if (query.search) {
            params.push(`%${query.search.toLowerCase()}%`);
            conditions.push(`(lower(c.name) LIKE $${params.length} OR c.mobile LIKE $${params.length})`);
        }
        if (query.customerId) {
            params.push(query.customerId);
            conditions.push(`c.id = $${params.length}`);
        }
        if (query.status === "PENDING")
            having.push(`COALESCE(p.paid_amount, 0) <= 0`);
        if (query.status === "PARTIAL") {
            having.push(`COALESCE(p.paid_amount, 0) > 0 AND (e.total_amount - COALESCE(p.paid_amount, 0)) > 0`);
        }
        if (query.status === "PAID")
            having.push(`(e.total_amount - COALESCE(p.paid_amount, 0)) <= 0`);
        const where = `WHERE ${conditions.join(" AND ")}`;
        const havingSql = having.length > 0 ? `HAVING ${having.join(" AND ")}` : "";
        const totalRow = await qOne(`SELECT COUNT(*) AS c FROM (
         SELECT c.id
         FROM customers c
         JOIN (
           SELECT customer_id, COUNT(*) AS entry_count, SUM(amount)::float AS total_amount, MAX(entry_date) AS last_entry_date
           FROM udhaari_entries
           WHERE store_id = $1
           GROUP BY customer_id
         ) e ON e.customer_id = c.id
         LEFT JOIN (
           SELECT ue.customer_id, SUM(up.amount)::float AS paid_amount
           FROM udhaari_payments up
           JOIN udhaari_entries ue ON ue.id = up.udhaari_entry_id
           WHERE up.store_id = $1
           GROUP BY ue.customer_id
         ) p ON p.customer_id = c.id
         ${where}
         GROUP BY c.id, c.name, c.mobile, e.entry_count, e.total_amount, p.paid_amount, e.last_entry_date
         ${havingSql}
       ) t`, params);
        const rows = await q(`SELECT c.id AS customer_id, c.name AS customer_name, c.mobile AS customer_mobile,
              e.entry_count, e.total_amount, COALESCE(p.paid_amount, 0) AS paid_amount, e.last_entry_date
       FROM customers c
       JOIN (
         SELECT customer_id, COUNT(*) AS entry_count, SUM(amount)::float AS total_amount, MAX(entry_date) AS last_entry_date
         FROM udhaari_entries
         WHERE store_id = $1
         GROUP BY customer_id
       ) e ON e.customer_id = c.id
       LEFT JOIN (
         SELECT ue.customer_id, SUM(up.amount)::float AS paid_amount
         FROM udhaari_payments up
         JOIN udhaari_entries ue ON ue.id = up.udhaari_entry_id
         WHERE up.store_id = $1
         GROUP BY ue.customer_id
       ) p ON p.customer_id = c.id
       ${where}
       GROUP BY c.id, c.name, c.mobile, e.entry_count, e.total_amount, p.paid_amount, e.last_entry_date
       ${havingSql}
       ORDER BY customer_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, query.limit, (query.page - 1) * query.limit]);
        const customers = rows.map((r) => {
            const total = Number(r.total_amount) ?? 0;
            const paid = Number(r.paid_amount) ?? 0;
            const outstanding = Math.max(0, total - paid);
            return {
                customerId: r.customer_id,
                customerName: r.customer_name,
                customerMobile: r.customer_mobile ?? null,
                entryCount: Number(r.entry_count) ?? 0,
                totalAmount: total,
                paidAmount: paid,
                outstanding,
                status: entryStatus(paid, total),
                lastEntryDate: r.last_entry_date,
            };
        });
        return { total: Number(totalRow?.c ?? 0), page: query.page, limit: query.limit, customers };
    });
    // Reminders: invoice-linked (and dated) udhaari entries sorted by due date.
    app.get("/reminders", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const query = parse(z.object({
            scope: z.enum(["all", "overdue", "today", "upcoming"]).optional().default("all"),
            search: z.string().optional(),
        }), request.query);
        const todayStr = new Date().toISOString().slice(0, 10);
        const params = [storeId];
        let searchSql = "";
        if (query.search) {
            params.push(`%${query.search.toLowerCase()}%`);
            searchSql = `AND (lower(c.name) LIKE $${params.length} OR c.mobile LIKE $${params.length})`;
        }
        const rows = await q(`SELECT e.id AS entry_id, e.customer_id, c.name AS customer_name, c.mobile AS customer_mobile,
              e.amount, COALESCE(p.paid, 0) AS paid, e.due_date, e.reminder_date,
              e.sale_id, s.invoice_number, e.created_at
       FROM udhaari_entries e
       JOIN customers c ON c.id = e.customer_id
       LEFT JOIN (
         SELECT udhaari_entry_id, SUM(amount)::float AS paid
         FROM udhaari_payments GROUP BY udhaari_entry_id
       ) p ON p.udhaari_entry_id = e.id
       LEFT JOIN sales s ON s.id = e.sale_id
       WHERE e.store_id = $1 AND e.due_date IS NOT NULL ${searchSql}
       ORDER BY e.due_date ASC, e.created_at ASC
       LIMIT 500`, params);
        const reminders = rows
            .map((r) => {
            const amount = Number(r.amount) ?? 0;
            const paid = Number(r.paid) ?? 0;
            const remaining = Math.max(0, amount - paid);
            const status = entryStatus(paid, amount);
            const dueDate = toYmd(r.due_date);
            const overdue = dueDate !== null && status !== "PAID" && dueDate < todayStr;
            return {
                entryId: r.entry_id,
                customerId: r.customer_id,
                customerName: r.customer_name,
                customerMobile: r.customer_mobile ?? null,
                amount,
                paid,
                remaining,
                dueDate,
                reminderDate: toYmd(r.reminder_date),
                invoiceNumber: r.invoice_number ?? null,
                saleId: r.sale_id ?? null,
                createdAt: r.created_at,
                status,
                overdue,
                overdueDays: overdue && dueDate ? Math.max(1, Math.floor((Date.parse(todayStr) - Date.parse(dueDate)) / 86400000)) : null,
            };
        })
            .filter((r) => {
            if (query.scope === "overdue")
                return r.overdue;
            if (query.scope === "today")
                return r.status !== "PAID" && r.dueDate === todayStr;
            if (query.scope === "upcoming")
                return r.status !== "PAID" && r.dueDate !== null && r.dueDate > todayStr;
            return true;
        });
        const count = (pred) => reminders.filter(pred).length;
        return {
            reminders,
            counts: {
                overdue: count((r) => r.overdue),
                today: count((r) => r.status !== "PAID" && r.dueDate === todayStr),
                upcoming: count((r) => r.status !== "PAID" && r.dueDate !== null && r.dueDate > todayStr),
            },
        };
    });
    // Entries + payments for a single customer (udhaari history)
    app.get("/:customerId", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const { customerId } = request.params;
        const customer = await qOne(`SELECT * FROM customers WHERE id = $1 AND store_id = $2`, [
            customerId,
            storeId,
        ]);
        if (!customer)
            throw ApiError.notFound("Customer not found");
        const [entries, payments] = await Promise.all([
            q(`SELECT e.id, e.amount, e.entry_date, e.due_date, e.reminder_date, e.note, e.sale_id, e.created_at,
                s.invoice_number
         FROM udhaari_entries e
         LEFT JOIN sales s ON s.id = e.sale_id
         WHERE e.customer_id = $1 AND e.store_id = $2
         ORDER BY e.entry_date DESC, e.created_at DESC`, [customerId, storeId]),
            q(`SELECT up.id, up.udhaari_entry_id, up.amount, up.mode, up.note, up.created_at
         FROM udhaari_payments up
         JOIN udhaari_entries e ON e.id = up.udhaari_entry_id
         WHERE e.customer_id = $1 AND e.store_id = $2
         ORDER BY up.created_at ASC`, [customerId, storeId]),
        ]);
        const byEntry = new Map();
        for (const p of payments) {
            const key = p.udhaari_entry_id;
            if (!byEntry.has(key))
                byEntry.set(key, []);
            byEntry.get(key).push(p);
        }
        const list = entries.map((e) => {
            const pays = byEntry.get(e.id) ?? [];
            const paid = pays.reduce((s, x) => s + Number(x.amount ?? 0), 0);
            const amount = Number(e.amount ?? 0);
            return {
                id: e.id,
                amount,
                entryDate: e.entry_date,
                dueDate: toYmd(e.due_date),
                reminderDate: toYmd(e.reminder_date),
                saleId: e.sale_id ?? null,
                invoiceNumber: e.invoice_number ?? null,
                note: e.note ?? null,
                createdAt: e.created_at,
                paid,
                remaining: Math.max(0, amount - paid),
                status: entryStatus(paid, amount),
                payments: pays.map((p) => ({
                    id: p.id,
                    amount: Number(p.amount) ?? 0,
                    mode: p.mode,
                    note: p.note ?? null,
                    createdAt: p.created_at,
                })),
            };
        });
        const total = list.reduce((s, e) => s + e.amount, 0);
        const paidTotal = list.reduce((s, e) => s + e.paid, 0);
        return {
            customer: {
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile ?? null,
                address: customer.address ?? null,
                gst: customer.gst ?? null,
            },
            totalAmount: total,
            paidAmount: paidTotal,
            outstanding: Math.max(0, total - paidTotal),
            entries: list,
        };
    });
    // Create a new udhaari entry (optional initial payment driven by `status`)
    app.post("/", { preHandler: authenticate }, async (request, reply) => {
        const storeId = requireStore(request);
        const body = parse(createSchema, request.body);
        const userId = getAuth(request).id;
        const entry = await withTx(async (tx) => {
            const customer = await resolveUdhaariCustomer(tx, storeId, body);
            const created = await tx.qOne(`INSERT INTO udhaari_entries (store_id, customer_id, amount, entry_date, due_date, reminder_date, note, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                storeId,
                customer.id,
                String(body.amount),
                body.entryDate ?? new Date().toISOString().slice(0, 10),
                body.dueDate ?? null,
                body.reminderDate ?? null,
                body.note || null,
                userId,
            ]);
            if (!created)
                throw new Error("Udhaari entry insert failed");
            await createLedgerEntry(tx, {
                customerId: customer.id,
                storeId,
                type: "DEBIT",
                amount: body.amount,
                referenceType: "UDHAARI",
                referenceId: created.id,
                note: body.note || "Udhaari entry",
            });
            let initialPaid = 0;
            if (body.status === "PAID")
                initialPaid = body.amount;
            else if (body.status === "PARTIAL" && body.initialPaid > 0)
                initialPaid = Math.min(body.initialPaid, body.amount);
            if (initialPaid > 0) {
                await applyUdhaariPayment(tx, {
                    entry: created,
                    storeId,
                    amount: initialPaid,
                    mode: "CASH",
                    note: `Initial payment for udhaari ${body.note || ""}`.trim(),
                    createdById: userId,
                });
            }
            return { entry: created, customer };
        });
        if (!entry)
            throw new Error("Udhaari entry insert failed");
        logger.info("udhaari: entry created", { storeId, customerId: entry.customer.id, entryId: entry.entry.id, by: userId });
        return reply.status(201).send({ entry: entry.entry, customer: entry.customer });
    });
    // Record a (partial) payment against a specific udhaari entry
    app.post("/:id/pay", { preHandler: authenticate }, async (request, reply) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const body = parse(paySchema, request.body);
        const userId = getAuth(request).id;
        // The entry, its already-paid total and the overpayment guard all run inside
        // one transaction under a row lock. Previously the read and the guard sat
        // OUTSIDE the transaction, so two concurrent payments both saw the same
        // remaining balance, both passed the check, and both inserted a payment —
        // settling the entry for more than it is worth.
        const result = await withTx(async (tx) => {
            const entry = await tx.qOne(`SELECT * FROM udhaari_entries WHERE id = $1 AND store_id = $2 FOR UPDATE`, [id, storeId]);
            if (!entry)
                throw ApiError.notFound("Udhaari entry not found");
            const paidRow = await tx.qOne(`SELECT COALESCE(SUM(amount), 0) AS sum FROM udhaari_payments WHERE udhaari_entry_id = $1`, [id]);
            const paid = money(paidRow?.sum ?? 0);
            const remaining = money(dec(entry.amount ?? 0).minus(paid));
            if (dec(body.amount).gt(remaining)) {
                throw ApiError.badRequest(`Payment exceeds remaining udhaari (₹${remaining.toFixed(2)} left).`);
            }
            const payment = await applyUdhaariPayment(tx, {
                entry,
                storeId,
                amount: body.amount,
                mode: body.mode,
                note: body.note || null,
                createdById: userId,
            });
            const newPaid = money(paid.plus(body.amount));
            const total = money(entry.amount ?? 0);
            return { payment, newPaid, total, remaining: money(total.minus(newPaid)) };
        });
        logger.info("udhaari: payment recorded", { storeId, entryId: id, amount: body.amount, by: userId });
        return reply.status(201).send({
            payment: result.payment,
            paid: result.newPaid.toNumber(),
            remaining: result.remaining.toNumber(),
            status: entryStatus(result.newPaid.toNumber(), result.total.toNumber()),
        });
    });
}
