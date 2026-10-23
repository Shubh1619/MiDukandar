import { z } from "zod";
import { q, qOne, qExec, withTx, qClient } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { buildUpdate } from "../lib/db.js";
import { authenticate, requireStore, requirePermission } from "../middlewares/auth.js";
import { boolFilter } from "./product.shared.js";
import { getCustomerOutstanding, setupCustomerOpeningBalance } from "../services/ledger.service.js";
import { logger } from "../lib/logger.js";
const customerSchema = z.object({
    name: z.string().min(1).max(120),
    mobile: z.string().max(15).optional().default(""),
    address: z.string().max(300).optional().default(""),
    city: z.string().max(60).optional().default(""),
    state: z.string().max(60).optional().default(""),
    pincode: z.string().max(10).optional().default(""),
    gst: z.string().max(30).optional().default(""),
    creditLimit: z.coerce.number().min(0).default(0),
    openingBalance: z.coerce.number().min(0).default(0),
});
export async function customerRoutes(app) {
    // List
    app.get("/", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const query = parse(paginationSchema.extend({ search: z.string().optional(), withBalance: boolFilter(false) }), request.query);
        const conditions = ["store_id = $1"];
        const params = [storeId];
        if (query.search) {
            params.push(`%${query.search.toLowerCase()}%`);
            conditions.push(`(lower(name) LIKE $${params.length} OR mobile LIKE $${params.length})`);
        }
        const where = `WHERE ${conditions.join(" AND ")}`;
        const totalRow = await qOne(`SELECT COUNT(*) AS c FROM customers ${where}`, params);
        const customers = await q(`SELECT * FROM customers ${where} ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, query.limit, (query.page - 1) * query.limit]);
        const rows = [];
        for (const c of customers) {
            const outstanding = await getCustomerOutstanding(qClient(), c.id);
            rows.push({ ...c, outstanding });
        }
        return { total: Number(totalRow?.c ?? 0), page: query.page, limit: query.limit, customers: rows };
    });
    // Create
    app.post("/", { preHandler: [authenticate, requirePermission("can_manage_customers")] }, async (request, reply) => {
        const storeId = requireStore(request);
        const body = parse(customerSchema, request.body);
        const userId = getAuth(request).id;
        const customer = await withTx(async (tx) => {
            const created = await tx.qOne(`INSERT INTO customers
           (store_id, name, mobile, address, city, state, pincode, gst, credit_limit, opening_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`, [
                storeId, body.name, body.mobile || null, body.address || null, body.city || null,
                body.state || null, body.pincode || null, body.gst || null, String(body.creditLimit),
                String(body.openingBalance),
            ]);
            if (!created)
                throw new Error("Customer insert failed");
            if (body.openingBalance > 0) {
                await setupCustomerOpeningBalance(tx, created.id, storeId, body.openingBalance);
            }
            return created;
        });
        if (!customer)
            throw new Error("Customer insert failed");
        logger.info("customer: created", { storeId, customerId: customer.id, by: userId });
        const outstanding = await getCustomerOutstanding(qClient(), customer.id);
        return reply.status(201).send({ customer: { ...customer, outstanding } });
    });
    // Detail + ledger + sales
    app.get("/:id", { preHandler: authenticate }, async (request) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const customer = await qOne(`SELECT * FROM customers WHERE id = $1 AND store_id = $2`, [id, storeId]);
        if (!customer)
            throw ApiError.notFound("Customer not found");
        const [outstanding, ledger, sales] = await Promise.all([
            getCustomerOutstanding(qClient(), customer.id),
            q(`SELECT id, type, amount, balance_after, reference_type, reference_id, note, created_at
         FROM ledger_entries WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]),
            q(`SELECT id, invoice_number, total, paid_amount, due_amount, payment_mode, created_at
         FROM sales WHERE customer_id = $1 AND status = 'CONFIRMED' ORDER BY created_at DESC LIMIT 30`, [id]),
        ]);
        return { customer: { ...customer, outstanding }, ledger, sales };
    });
    // Update
    app.put("/:id", { preHandler: [authenticate, requirePermission("can_manage_customers")] }, async (request) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const body = parse(customerSchema.partial(), request.body);
        const existing = await qOne(`SELECT id FROM customers WHERE id = $1 AND store_id = $2`, [id, storeId]);
        if (!existing)
            throw ApiError.notFound("Customer not found");
        const numericFields = ["creditLimit", "openingBalance"];
        const entries = [];
        for (const [k, v] of Object.entries(body)) {
            if (v === undefined)
                continue;
            const val = numericFields.includes(k) ? String(v) : v === "" ? null : v;
            entries.push([k, val]);
        }
        const update = buildUpdate("customers", entries, { id });
        if (!update)
            return { ok: true };
        const customer = await qOne(update.sql, update.params);
        const outstanding = await getCustomerOutstanding(qClient(), id);
        return { customer: { ...customer, outstanding } };
    });
    // Delete (hard delete; ledger + udhaari cascade, sales/payments keep history with nulled customer)
    app.delete("/:id", { preHandler: [authenticate, requirePermission("can_manage_customers")] }, async (request, reply) => {
        const storeId = requireStore(request);
        const { id } = request.params;
        const existing = await qOne(`SELECT id, name FROM customers WHERE id = $1 AND store_id = $2`, [id, storeId]);
        if (!existing)
            throw ApiError.notFound("Customer not found");
        await qExec(`DELETE FROM customers WHERE id = $1 AND store_id = $2`, [id, storeId]);
        logger.info("customer: deleted", { storeId, customerId: id, name: existing.name, by: getAuth(request).id });
        return reply.send({ ok: true });
    });
}
function getAuth(request) {
    const auth = request.auth;
    if (!auth)
        throw ApiError.unauthorized();
    return auth;
}
