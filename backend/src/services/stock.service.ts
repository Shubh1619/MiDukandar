import type { DbClient, Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";

type Tx = DbClient;

/**
 * Returns the current stock balance of a product by summing its movement
 * ledger. Balance is ALWAYS derived - it is never a stored counter.
 */
async function getStockBalance(db: Tx, productId: string): Promise<number> {
  const row = await db.qOne<{ sum: number | null }>(
    `SELECT COALESCE(SUM(qty), 0) AS sum FROM stock_movements WHERE product_id = $1`,
    [productId],
  );
  return row?.sum ?? 0;
}

export interface StockTaggedRow extends Row {
  stock: number;
  isLow: boolean;
}

/**
 * Returns the current stock balance of products by summing the movement
 * ledger. Balance is ALWAYS derived - it is never a stored counter.
 * When `storeId` is given, balances are scoped to that store's movements.
 */
export async function getStockBalances(
  db: Tx,
  productIds: string[],
  storeId?: string,
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const params: unknown[] = [productIds];
  let sql = `SELECT product_id, qty FROM stock_movements WHERE product_id = ANY($1::uuid[])`;
  if (storeId) {
    params.push(storeId);
    sql += ` AND store_id = $${params.length}`;
  }
  const rows = await db.q<{ product_id: string; qty: number }>(sql, params);
  const balances: Record<string, number> = {};
  for (const r of rows) {
    balances[r.product_id] = (balances[r.product_id] ?? 0) + r.qty;
  }
  return balances;
}

/**
 * Attaches the current `stock` balance and `isLow` flag to a list of product
 * rows (each expected to carry `id` and `min_stock`).
 */
export async function mapLow(db: Tx, rows: Row[], storeId?: string): Promise<StockTaggedRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);
  const balances = await getStockBalances(db, ids, storeId);
  return rows.map((r) => {
    const stock = balances[r.id as string] ?? 0;
    return { ...r, stock, isLow: stock < Number(r.min_stock) };
  });
}

export interface MovementInput {
  productId: string;
  storeId?: string;
  qty: number; // signed: + in, - out
  type: "OPENING" | "SALE" | "PURCHASE" | "ADJUSTMENT" | "REVERSAL";
  referenceType: string;
  referenceId?: string;
  note?: string;
  createdById?: string;
}

/**
 * Appends a stock movement and returns the running balance AFTER the entry.
 * Must be called inside a transaction for sales/purchases.
 */
export async function createStockMovement(db: Tx, input: MovementInput): Promise<number> {
  if (!Number.isFinite(input.qty) || input.qty === 0) {
    throw ApiError.badRequestCode("Stock movement qty must be non-zero.", "INVALID_QTY");
  }
  const balanceBefore = await getStockBalance(db, input.productId);
  const balanceAfter = balanceBefore + input.qty;

  let storeId = input.storeId;
  if (!storeId) {
    const prod = await db.qOne<{ store_id: string }>(
      `SELECT store_id FROM products WHERE id = $1`,
      [input.productId],
    );
    storeId = prod?.store_id;
  }

  await db.q(
    `INSERT INTO stock_movements
       (product_id, store_id, qty, type, reference_type, reference_id, balance_after, note, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.productId,
      storeId,
      input.qty,
      input.type,
      input.referenceType,
      input.referenceId ?? null,
      balanceAfter,
      input.note ?? null,
      input.createdById ?? null,
    ],
  );
  return balanceAfter;
}