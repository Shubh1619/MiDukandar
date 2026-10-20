/**
 * Helpers, schemas and types shared by the product route modules.
 *
 * product.routes.ts is the composition root, but it also registers
 * product-import.routes.ts and product-export.routes.ts. Those sub-modules need
 * the filter/summary/scrub helpers, so the code cannot live in the root without
 * the sub-modules importing the module that imports them — an ESM cycle that
 * works only because every use is deferred to request time. Keeping the shared
 * pieces here breaks the cycle explicitly.
 */
import { z } from "zod";
import { q, type Row, type DbClient } from "../db/pool.js";
import { mapLow } from "../services/stock.service.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// z.coerce.boolean() turns the string "false" into true (Boolean("false") === true),
// which silently inverted the archived filter. Parse query booleans explicitly.
export const boolFilter = (asDefault: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .default(asDefault ? "true" : "false")
    .transform((v) => v === "true" || v === "1");

export const filterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  archived: boolFilter(false),
  lowStock: boolFilter(false),
  stockStatus: z.enum(["all", "in", "low", "out"]).optional(),
  gst: z.coerce.number().min(0).max(100).optional(),
  unit: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
});

export type FilterSettings = z.infer<typeof filterSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function stripCostFields(row: Row) {
  void (delete row.purchasePrice, delete row.purchase_price);
}

export function applyRoleCost(rows: Row[], role: string) {
  if (role === "CASHIER") for (const r of rows) stripCostFields(r);
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

// Postgres rejects embedded NUL bytes in text columns. Strip them at the
// boundary so PDF/CSV extraction quirks never surface as a 500. Also coerce
// empty strings back to NULL so optional columns (barcode, sku, …) don't
// collide on legacy unique indexes.
export const scrubNul = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v);
  // eslint-disable-next-line no-control-regex -- intentional: strip embedded NUL bytes (see comment above)
  const cleaned = s.includes("\u0000") ? s.replace(/\u0000/g, "") : s;
  return cleaned === "" ? null : cleaned;
};

export async function computeSummary(storeId: string) {
  const rows = await q<Row>(
    `SELECT p.id, p.purchase_price, p.min_stock, p.is_archived, COALESCE(SUM(sm.qty), 0) AS stock
     FROM products p
     LEFT JOIN stock_movements sm ON sm.product_id = p.id
     WHERE p.store_id = $1
     GROUP BY p.id`,
    [storeId],
  );
  let total = 0;
  let active = 0;
  let low = 0;
  let out = 0;
  let archived = 0;
  let value = 0;
  for (const r of rows) {
    total++;
    const stock = Number(r.stock);
    value += stock * Number(r.purchase_price ?? 0);
    if (r.is_archived) {
      archived++;
      continue;
    }
    active++;
    if (stock < Number(r.min_stock)) low++;
    if (stock <= 0) out++;
  }
  return { total, active, low, out, archived, value };
}

export interface FilterRows {
  rows: Row[];
  summary: { total: number; active: number; low: number; out: number };
}

export async function fetchFilteredRows(
  db: DbClient,
  storeId: string,
  query: FilterSettings,
): Promise<FilterRows> {
  const conditions: string[] = ["p.store_id = $1"];
  const params: unknown[] = [storeId];

  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    conditions.push(
      `(lower(p.name) LIKE $${params.length} OR p.barcode LIKE $${params.length} OR lower(p.sku) LIKE $${params.length})`,
    );
  }
  if (query.category) {
    params.push(query.category);
    conditions.push(`p.category = $${params.length}`);
  }
  if (query.gst != null) {
    params.push(query.gst);
    conditions.push(`p.gst_percent = $${params.length}`);
  }
  if (query.unit) {
    params.push(query.unit);
    conditions.push(`p.unit = $${params.length}`);
  }
  if (query.priceMin != null) {
    params.push(query.priceMin);
    conditions.push(`p.selling_price >= $${params.length}`);
  }
  if (query.priceMax != null) {
    params.push(query.priceMax);
    conditions.push(`p.selling_price <= $${params.length}`);
  }
  params.push(query.archived);
  conditions.push(`p.is_archived = $${params.length}`);

  const where = `WHERE ${conditions.join(" AND ")}`;

  const orderBy = query.archived
    ? "p.archived_at DESC NULLS LAST, p.created_at DESC"
    : "p.created_at DESC";

  const all = await db.q<Row>(
    `SELECT p.*, u.name AS archived_by_name
     FROM products p
     LEFT JOIN users u ON u.id = p.archived_by_id
     ${where} ORDER BY ${orderBy}`,
    params,
  );

  let rows = await mapLow(db, all);
  if (query.lowStock || query.stockStatus) {
    rows = rows.filter((r) => {
      const stock = Number(r.stock);
      const status = query.stockStatus;
      if (status === "low" || query.lowStock) return stock < Number(r.min_stock);
      if (status === "out") return stock <= 0;
      if (status === "in") return stock > 0;
      return true;
    });
  }

  const summary = {
    total: rows.length,
    active: rows.filter((r) => !r.isArchived).length,
    low: rows.filter((r) => !r.isArchived && Number(r.stock) < Number(r.min_stock)).length,
    out: rows.filter((r) => !r.isArchived && Number(r.stock) <= 0).length,
  };

  return { rows, summary };
}
