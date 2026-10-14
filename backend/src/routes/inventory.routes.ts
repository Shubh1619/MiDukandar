import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, qClient, type Row } from "../db/pool.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, type AuthenticatedRequest } from "../middlewares/auth.js";
import { getCurrentStock } from "../services/report.service.js";

export async function inventoryRoutes(app: FastifyInstance) {
  // Current stock (derived from movement ledger) + optional low-only filter
  app.get("/stock/current", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      z.object({ lowOnly: z.coerce.boolean().default(false), search: z.string().optional() }),
      request.query,
    );
    const rows = await getCurrentStock(qClient(), storeId, { lowOnly: query.lowOnly, search: query.search });
    return { stock: rows };
  });

  // Low stock items (dashboard indicator source)
  app.get("/stock/low", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const rows = await getCurrentStock(qClient(), storeId, { lowOnly: true });
    return { count: rows.length, items: rows.map((r) => ({ id: r.id, name: r.name, balance: r.balance, minStock: r.minStock })) };
  });

  // Stock movement history (append-only ledger)
  app.get("/movements", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({
        productId: z.string().optional(),
        type: z.enum(["OPENING", "SALE", "PURCHASE", "ADJUSTMENT", "REVERSAL"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      request.query,
    );
    const conditions = ["m.store_id = $1"];
    const params: unknown[] = [storeId];
    if (query.productId) { params.push(query.productId); conditions.push(`m.product_id = $${params.length}`); }
    if (query.type) { params.push(query.type); conditions.push(`m.type = $${params.length}`); }
    if (query.from) { params.push(query.from); conditions.push(`m.created_at >= $${params.length}`); }
    if (query.to) { params.push(query.to); conditions.push(`m.created_at <= $${params.length}`); }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const totalRow = await qOneCount(`SELECT COUNT(*) AS c FROM stock_movements m ${where}`, params);
    const movements = await q<Row>(
      `SELECT m.*, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit
         FROM stock_movements m
         LEFT JOIN products p ON p.id = m.product_id
         ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return { total: totalRow, page: query.page, limit: query.limit, movements };
  });
}

async function qOneCount(text: string, params: unknown[]): Promise<number> {
  const rows = await q<{ c: number }>(text, params);
  return Number(rows[0]?.c ?? 0);
}