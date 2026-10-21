/**
 * Product route composition root and core CRUD.
 *
 * This module owns the list/summary/category reads and the single-product
 * create/update/archive/restore/delete/adjust endpoints. Bulk import and export
 * live in product-import.routes.ts and product-export.routes.ts; the schemas and
 * helpers they share are in product.shared.ts.
 *
 * Registration order is load-bearing. Every static path (`/summary`,
 * `/categories`, `/import/*`, `/export/*`, `/template*`) is registered before
 * `GET /:id`, otherwise the parameterised route would capture those literal
 * paths and treat "summary" as a product id.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { q, qOne, qExec, withTx, qClient, type Row, type DbClient } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { buildUpdate } from "../lib/db.js";
import {
  authenticate, requireStore, requireRole, requirePermission, getAuth, type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { createStockMovement, mapLow } from "../services/stock.service.js";
import { normalizeName } from "../services/product-import.service.js";
import { logger } from "../lib/logger.js";
import { invalidateDashboardCache } from "../lib/dashboard-cache.js";
import { getModuleLimit } from "../lib/plans.js";
import { productImportRoutes } from "./product-import.routes.js";
import { productExportRoutes } from "./product-export.routes.js";
import {
  applyRoleCost, computeSummary, fetchFilteredRows, filterSchema, isUniqueViolation,
  scrubNul, stripCostFields,
} from "./product.shared.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const idParamSchema = z.object({ id: z.string().uuid() });

// Optional ISO date (YYYY-MM-DD). Empty string clears the value to NULL.
const optionalDate = z
  .string()
  .optional()
  .refine(
    (v) => v === undefined || v.trim() === "" || !Number.isNaN(Date.parse(v)),
    { message: "Invalid date. Use an ISO date such as 2026-01-31." },
  );

const productSchema = z.object({
  name: z.string().min(1).max(150),
  barcode: z.string().max(64).optional().default(""),
  sku: z.string().max(64).optional().default(""),
  category: z.string().max(80).optional().default(""),
  unit: z.string().max(16).optional().default("pc"),
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  mrp: z.coerce.number().min(0).optional(),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  minStock: z.coerce.number().min(0).default(0),
  supplier: z.string().max(150).optional().default(""),
  imageUrl: z.string().max(500).optional().default(""),
  openingStock: z.coerce.number().min(0).optional().default(0),
  description: z.string().max(2000).optional().default(""),
  expiryDate: optionalDate,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DupCandidate { name: string; sku: string; barcode: string }

async function findDuplicate(
  db: DbClient,
  storeId: string,
  input: DupCandidate,
  excludeId?: string,
): Promise<Row | null> {
  for (const archived of [false, true]) {
    const orParams: unknown[] = [];
    const orClauses: string[] = [];
    if (input.barcode) {
      orParams.push(input.barcode);
      orClauses.push(`barcode = $${orParams.length + 2}`);
    }
    if (input.sku) {
      orParams.push(input.sku);
      orClauses.push(`sku = $${orParams.length + 2}`);
    }
    // Name is always a conflict trigger (case/whitespace-insensitive), matching
    // the documented "same name → conflict" rule, regardless of whether the
    // new or existing row carries a SKU/barcode.
    orParams.push(normalizeName(input.name));
    orClauses.push(
      `lower(trim(regexp_replace(name, '\\s+', ' ', 'g'))) = $${orParams.length + 2}`,
    );
    if (orClauses.length === 0) return null;
    const params: unknown[] = [storeId, archived, ...orParams];
    const excludeSql = excludeId ? ` AND id <> $${params.length + 1}` : "";
    if (excludeId) params.push(excludeId);
    const row = await db.qOne<Row>(
      `SELECT id, name, sku, barcode, is_archived FROM products
       WHERE store_id = $1 AND is_archived = $2 AND (${orClauses.join(" OR ")})${excludeSql}
       ORDER BY created_at DESC LIMIT 1`,
      params,
    );
    if (row) return row;
  }
  return null;
}

function dupConflict(duplicate: Row): ApiError {
  const archived = Boolean(duplicate.is_archived);
  return ApiError.conflictCode(
    archived
      ? "An archived product with this name/SKU/barcode already exists."
      : "An active product with this name/SKU/barcode already exists.",
    "PRODUCT_EXISTS",
    {
      existing: {
        id: duplicate.id,
        name: duplicate.name,
        sku: duplicate.sku,
        barcode: duplicate.barcode,
        archived,
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function productRoutes(app: FastifyInstance) {
  const managerOnly = requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.STOCK_MANAGER);

  // Static sub-paths first — see the registration-order note at the top of this
  // file. `/:id` is registered last.
  await productImportRoutes(app);
  await productExportRoutes(app);

  // List with search + filters + pagination
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(filterSchema.extend(paginationSchema.shape), request.query);
    const { rows, summary } = await fetchFilteredRows(qClient(), storeId, query);

    const total = rows.length;
    const pageRows = rows.slice((query.page - 1) * query.limit, query.page * query.limit);
    applyRoleCost(pageRows, getAuth(request).role);

    const storeSummary = await computeSummary(storeId);
    return {
      total,
      page: query.page,
      limit: query.limit,
      products: pageRows,
      summary: storeSummary,
      filteredSummary: summary,
    };
  });

  // Summary cards (whole store, live from backend)
  app.get("/summary", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    return { summary: await computeSummary(storeId) };
  });

  // Expiry alert: products already expired or expiring within the store's
  // configured window (stores.expiry_warning_days). Feeds the web/mobile popup.
  app.get("/expiring", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const store = await qOne<{ expiry_warning_days: number }>(
      `SELECT expiry_warning_days FROM stores WHERE id = $1`,
      [storeId],
    );
    const warningDays = Number(store?.expiry_warning_days ?? 30);

    // Days remaining is computed against today in IST, matching how the app
    // renders dates elsewhere (a UTC "today" would flip near midnight).
    const rows = await q<Row>(
      `SELECT id, name, sku, barcode, category, unit, selling_price, expiry_date,
              (expiry_date - (now() AT TIME ZONE 'Asia/Kolkata')::date) AS days_left
       FROM products
       WHERE store_id = $1 AND is_archived = FALSE AND expiry_date IS NOT NULL
         AND expiry_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date + ($2::int)
       ORDER BY expiry_date ASC`,
      [storeId, warningDays],
    );
    applyRoleCost(rows, getAuth(request).role);

    const expired: Row[] = [];
    const expiringSoon: Row[] = [];
    for (const r of rows) {
      if (Number(r.days_left) < 0) expired.push(r);
      else expiringSoon.push(r);
    }
    return { expired, expiringSoon, warningDays };
  });

  // Categories
  app.get("/categories", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const rows = await q<Row>(
      `SELECT DISTINCT category FROM products WHERE store_id = $1 AND category IS NOT NULL`,
      [storeId],
    );
    return { categories: rows.map((r) => r.category).filter(Boolean) };
  });

  // Add product (+ optional opening stock movement)
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.STOCK_MANAGER), requirePermission("can_manage_products")] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
       const body = parse(productSchema, request.body);
       const userId = getAuth(request).id;
       const productLimit = await getModuleLimit(storeId, "PRODUCTS");
       if (productLimit != null && productLimit > 0) {
         const countRow = await qOne<Row>(`SELECT COUNT(*)::int AS count FROM products WHERE store_id = $1 AND is_archived = FALSE`, [storeId]);
         if (Number(countRow?.count ?? 0) >= productLimit) {
           throw ApiError.forbidden(`Your plan allows up to ${productLimit} active products.`);
         }
       }

       const duplicate = await findDuplicate(qClient(), storeId, { name: body.name, sku: body.sku, barcode: body.barcode });
      if (duplicate) throw dupConflict(duplicate);

      try {
        const product = await withTx(async (tx) => {
          const created = await tx.qOne<Row>(
            `INSERT INTO products
               (store_id, name, barcode, sku, category, unit, purchase_price, selling_price, mrp,
                gst_percent, min_stock, supplier, image_url, description, expiry_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING *`,
            [
              storeId, scrubNul(body.name), scrubNul(body.barcode), scrubNul(body.sku), scrubNul(body.category),
              scrubNul(body.unit) ?? "pc", String(body.purchasePrice), String(body.sellingPrice),
              body.mrp != null ? String(body.mrp) : null, String(body.gstPercent), String(body.minStock),
              scrubNul(body.supplier), scrubNul(body.imageUrl), scrubNul(body.description),
              scrubNul(body.expiryDate),
            ],
          );
          if (!created) throw new Error("Product insert failed");
          if (body.openingStock > 0) {
            await createStockMovement(tx, {
              productId: created.id as string,
              storeId,
              qty: body.openingStock,
              type: "OPENING",
              referenceType: "OPENING",
              note: "Opening stock on product creation",
              createdById: userId,
            });
          }
          return created;
        });
        if (!product) throw new Error("Product insert failed");

        if (getAuth(request).role === "CASHIER") stripCostFields(product);
        logger.info("product: created", { storeId, productId: product.id });
        invalidateDashboardCache(storeId);
        const [stocked, summary] = await Promise.all([
          mapLow(qClient(), [product]),
          computeSummary(storeId),
        ]);
        return reply.status(201).send({ product: stocked[0], summary });
      } catch (err) {
        if (isUniqueViolation(err)) throw dupConflict({ id: null, name: body.name, sku: body.sku, barcode: body.barcode, is_archived: false });
        throw err;
      }
    },
  );

  // Single product + recent movements
  app.get("/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = parse(idParamSchema, request.params);
    const product = await qOne<Row>(`SELECT p.*, u.name AS archived_by_name
      FROM products p LEFT JOIN users u ON u.id = p.archived_by_id
      WHERE p.id = $1 AND p.store_id = $2`, [id, storeId]);
    if (!product) throw ApiError.notFound("Product not found");
    const [stocked, movements] = await Promise.all([
      mapLow(qClient(), [product]),
      q<Row>(
        `SELECT id, qty, type, reference_type, reference_id, balance_after, note, created_at
         FROM stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [product.id as string],
      ),
    ]);
    if (getAuth(request).role === "CASHIER") stripCostFields(product);
    return {
      product: stocked[0],
      movements,
    };
  });

  // Update product
  app.put(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.STOCK_MANAGER), requirePermission("can_manage_products")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = parse(idParamSchema, request.params);
      const body = parse(productSchema.omit({ openingStock: true, imageUrl: true }).partial(), request.body);

      const existing = await qOne<Row>(`SELECT * FROM products WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!existing) throw ApiError.notFound("Product not found");

      const merge = {
        name: String(body.name ?? existing.name),
        sku: body.sku != null ? String(body.sku) : existing.sku ? String(existing.sku) : "",
        barcode: body.barcode != null ? String(body.barcode) : existing.barcode ? String(existing.barcode) : "",
      };
      const duplicate = await findDuplicate(qClient(), storeId, merge, id);
      if (duplicate) throw dupConflict(duplicate);

      const numericFields = ["purchasePrice", "sellingPrice", "mrp", "gstPercent", "minStock"];
      const entries: Array<[string, unknown]> = [];
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined) continue;
        const val = numericFields.includes(k) ? (v === null ? null : String(v)) : v === "" ? null : v;
        entries.push([k, typeof val === "string" ? scrubNul(val) : val]);
      }
      const update = buildUpdate("products", entries, { id, storeId });
      if (!update) {
        const stocked = await mapLow(qClient(), [existing]);
        return { product: stocked[0] };
      }

      try {
        const product = await qOne<Row>(update.sql, update.params);
        if (!product) throw ApiError.notFound("Product not found");
        logger.info("product: updated", { storeId, productId: id });
        invalidateDashboardCache(storeId);
        const [stocked, summary] = await Promise.all([
          mapLow(qClient(), [product]),
          computeSummary(storeId),
        ]);
        return { product: stocked[0], summary };
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw dupConflict({ id: null, name: merge.name, sku: merge.sku, barcode: merge.barcode, is_archived: false });
        }
        throw err;
      }
    },
  );

  // Archive / unarchive (soft delete with metadata)
  app.patch(
    "/:id/archive",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER), requirePermission("can_manage_products")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = parse(idParamSchema, request.params);
      const body = (request.body ?? {}) as { archived?: boolean };
      const toArchive = body.archived ?? true;
      const user = getAuth(request);
      const res = await qExec(
        `UPDATE products SET is_archived = $1,
           archived_at = CASE WHEN $1 THEN now() ELSE NULL END,
           archived_by_id = CASE WHEN $1 THEN $2::uuid ELSE NULL END,
           updated_at = now()
         WHERE id = $3 AND store_id = $4`,
        [toArchive, user.id, id, storeId],
      );
      if (res === 0) throw ApiError.notFound("Product not found");
      logger.info("product: archived", { storeId, productId: id, archived: toArchive, by: user.id });
      invalidateDashboardCache(storeId);
      return { ok: true, archived: toArchive, summary: await computeSummary(storeId) };
    },
  );

  // Restore archived product (with duplicate-conflict check)
  app.post(
    "/:id/restore",
    { preHandler: [authenticate, managerOnly, requirePermission("can_manage_products")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = parse(idParamSchema, request.params);
      const product = await qOne<Row>(`SELECT * FROM products WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!product) throw ApiError.notFound("Product not found");
      if (!product.isArchived) {
        const stocked = await mapLow(qClient(), [product]);
        return { ok: true, product: stocked[0] };
      }
      const candidate = { name: String(product.name), sku: product.sku ? String(product.sku) : "", barcode: product.barcode ? String(product.barcode) : "" };
      const conflict = await findDuplicate(qClient(), storeId, candidate, id);
      if (conflict) {
        throw ApiError.conflictCode(
          "This product conflicts with an existing active product (same SKU/barcode/name).",
          "PRODUCT_CONFLICT",
          { existing: { id: conflict.id, name: conflict.name, sku: conflict.sku, barcode: conflict.barcode } },
        );
      }
      await qExec(
        `UPDATE products SET is_archived = FALSE, archived_at = NULL, archived_by_id = NULL, updated_at = now() WHERE id = $1`,
        [id],
      );
      logger.info("product: restored", { storeId, productId: id });
      invalidateDashboardCache(storeId);
      const [stocked, summary] = await Promise.all([
        mapLow(qClient(), [product]),
        computeSummary(storeId),
      ]);
      return { ok: true, product: { ...stocked[0], is_archived: false, archived_at: null }, summary };
    },
  );

  // Permanent delete - only archived products, OWNER only
  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = parse(idParamSchema, request.params);
      const product = await qOne<Row>(`SELECT id, is_archived FROM products WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!product) throw ApiError.notFound("Product not found");
      if (!product.isArchived) {
        throw ApiError.badRequest("Active products cannot be permanently deleted. Archive the product first.");
      }
      await qExec(`DELETE FROM products WHERE id = $1 AND store_id = $2 AND is_archived = TRUE`, [id, storeId]);
      logger.info("product: permanently deleted", { storeId, productId: id });
      invalidateDashboardCache(storeId);
      return { ok: true, summary: await computeSummary(storeId) };
    },
  );

  // Stock adjustment (ADJUSTMENT movement)
  app.post(
    "/:id/adjust",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.STOCK_MANAGER), requirePermission("can_manage_products")] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = parse(idParamSchema, request.params);
      const body = parse(
        z.object({ qty: z.coerce.number(), reason: z.string().max(300).optional().default("Manual adjustment") }),
        request.body,
      );
      const product = await qOne<Row>(`SELECT id, is_archived FROM products WHERE id = $1 AND store_id = $2`, [id, storeId]);
      if (!product) throw ApiError.notFound("Product not found");
      if (product.isArchived) throw ApiError.badRequest("Archived products cannot be adjusted.");
      if (body.qty === 0) throw ApiError.badRequest("Adjustment qty cannot be zero.");

      const balanceAfter = await withTx((tx) =>
        createStockMovement(tx, {
          productId: id,
          storeId,
          qty: body.qty,
          type: "ADJUSTMENT",
          referenceType: "ADJUSTMENT",
          note: body.reason,
          createdById: getAuth(request).id,
        }),
      );
      logger.info("product: stock adjusted", { storeId, productId: id, qty: body.qty, balanceAfter });
      invalidateDashboardCache(storeId);
      return { ok: true, balanceAfter };
    },
  );
}
