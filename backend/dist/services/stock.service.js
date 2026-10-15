import { ApiError } from "../lib/api-error.js";
/**
 * Returns the current stock balance of a product by summing its movement
 * ledger. Balance is ALWAYS derived - it is never a stored counter.
 */
async function getStockBalance(db, productId) {
    const row = await db.qOne(`SELECT COALESCE(SUM(qty), 0) AS sum FROM stock_movements WHERE product_id = $1`, [productId]);
    return row?.sum ?? 0;
}
/**
 * Returns the current stock balance of products by summing the movement
 * ledger. Balance is ALWAYS derived - it is never a stored counter.
 * When `storeId` is given, balances are scoped to that store's movements.
 */
export async function getStockBalances(db, productIds, storeId) {
    if (productIds.length === 0)
        return {};
    const params = [productIds];
    let sql = `SELECT product_id, qty FROM stock_movements WHERE product_id = ANY($1::uuid[])`;
    if (storeId) {
        params.push(storeId);
        sql += ` AND store_id = $${params.length}`;
    }
    const rows = await db.q(sql, params);
    const balances = {};
    for (const r of rows) {
        balances[r.product_id] = (balances[r.product_id] ?? 0) + r.qty;
    }
    return balances;
}
/**
 * Attaches the current `stock` balance and `isLow` flag to a list of product
 * rows (each expected to carry `id` and `min_stock`).
 */
export async function mapLow(db, rows, storeId) {
    if (rows.length === 0)
        return [];
    const ids = rows.map((r) => r.id);
    const balances = await getStockBalances(db, ids, storeId);
    return rows.map((r) => {
        const stock = balances[r.id] ?? 0;
        return { ...r, stock, isLow: stock < Number(r.min_stock) };
    });
}
/**
 * Appends a stock movement and returns the running balance AFTER the entry.
 * Must be called inside a transaction for sales/purchases.
 */
export async function createStockMovement(db, input) {
    if (!Number.isFinite(input.qty) || input.qty === 0) {
        throw ApiError.badRequestCode("Stock movement qty must be non-zero.", "INVALID_QTY");
    }
    const balanceBefore = await getStockBalance(db, input.productId);
    const balanceAfter = balanceBefore + input.qty;
    let storeId = input.storeId;
    if (!storeId) {
        const prod = await db.qOne(`SELECT store_id FROM products WHERE id = $1`, [input.productId]);
        storeId = prod?.store_id;
    }
    await db.q(`INSERT INTO stock_movements
       (product_id, store_id, qty, type, reference_type, reference_id, balance_after, note, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
        input.productId,
        storeId,
        input.qty,
        input.type,
        input.referenceType,
        input.referenceId ?? null,
        balanceAfter,
        input.note ?? null,
        input.createdById ?? null,
    ]);
    return balanceAfter;
}
