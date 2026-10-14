/**
 * Bulk product import: CSV/Excel preview + commit, PDF text extraction, and
 * Google Sheets ingest. Registered by productRoutes before the core routes so
 * the static `/import/*` paths are never captured by `GET /:id`.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { qClient, withTx, type Row } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import {
  authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { createStockMovement } from "../services/stock.service.js";
import {
  normalizeName, sanitizeExtractedLine, loadImportContext, resolveMatch, dupKeyOf, validateImportRow,
  type ImportRow,
} from "../services/product-import.service.js";
import { logger } from "../lib/logger.js";
import { extractPdfText } from "../lib/pdf-extract.js";
import { getModuleLimit } from "../lib/plans.js";
import { computeSummary, isUniqueViolation, scrubNul } from "./product.shared.js";

const IMPORT_MAX_ROWS = 2000;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && r.some((c) => c.trim() !== ""));
}

export async function productImportRoutes(app: FastifyInstance) {
  const managerOnly = requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.STOCK_MANAGER);

  // Bulk import preview - validates rows against the actual product dataset
  app.post(
    "/import/preview",
    { preHandler: [authenticate, managerOnly] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { rows } = parse(z.object({ rows: z.array(z.unknown()).max(IMPORT_MAX_ROWS) }), request.body);
      const ctx = await loadImportContext(qClient(), storeId);

      const seenFile = new Map<string, number>();
      const results: {
        index: number;
        status: "valid" | "duplicate" | "error";
        message?: string;
        product: ImportRow | null;
      }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const v = validateImportRow(rows[i]);
        if (!v.ok) {
          results.push({ index: i, status: "error", message: v.message, product: v.product });
          continue;
        }
        const r = v.product;

        const dupKey = dupKeyOf(r);
        const firstFileRow = seenFile.get(dupKey);
        if (firstFileRow != null) {
          results.push({
            index: i,
            status: "duplicate",
            message: `Duplicate of row ${firstFileRow + 1} in this file`,
            product: r,
          });
          continue;
        }
        seenFile.set(dupKey, i);

        const match = resolveMatch(ctx, r);
        if (match) {
          results.push({
            index: i,
            status: "duplicate",
            message: match.isArchived
              ? "Matches an archived product (same SKU/barcode)"
              : "Matches an existing active product",
            product: r,
          });
          continue;
        }

        results.push({ index: i, status: "valid", product: r });
      }

      const counts = {
        total: results.length,
        valid: results.filter((r) => r.status === "valid").length,
        duplicate: results.filter((r) => r.status === "duplicate").length,
        error: results.filter((r) => r.status === "error").length,
      };
      return { counts, results };
    },
  );

  // Bulk import (insert/update/skip)
  app.post(
    "/import",
    { preHandler: [authenticate, managerOnly] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const user = getAuth(request);
      const body = parse(
        z.object({
          rows: z.array(z.unknown()).max(IMPORT_MAX_ROWS),
          mode: z.enum(["skip", "update"]),
        }),
        request.body,
      );

      const result = await withTx(async (tx) => {
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        const errors: { index: number; message: string }[] = [];

        await tx.query(`SELECT id FROM stores WHERE id = $1 FOR UPDATE`, [storeId]);
        const productLimit = await getModuleLimit(storeId, "PRODUCTS", tx);
        const countRow = await tx.qOne<Row>(
          `SELECT COUNT(*)::int AS count FROM products WHERE store_id = $1 AND is_archived = FALSE`,
          [storeId],
        );
        let activeProductCount = Number(countRow?.count ?? 0);
        const ctx = await loadImportContext(tx, storeId);

        for (let i = 0; i < body.rows.length; i++) {
          const raw = body.rows[i];
          const rawName =
            typeof raw === "object" && raw !== null && "name" in raw
              ? String((raw as { name?: unknown }).name ?? "")
              : "";
          try {
            const v = validateImportRow(raw);
            if (!v.ok) {
              failed++;
              errors.push({ index: i, message: v.message });
              continue;
            }
            const r = v.product;
            const match = resolveMatch(ctx, r);
            if (match) match.is_archived = !!match.is_archived;

            if (match && !match.is_archived && body.mode === "update") {
              const before = match;
              await tx.q(
                `UPDATE products SET
                   name = $1, category = $2, sku = $3, barcode = $4, unit = $5,
                   purchase_price = $6, selling_price = $7, gst_percent = $8, min_stock = $9,
                   supplier = $10, description = $11, updated_at = now()
                 WHERE id = $12`,
                [
                  scrubNul(r.name.trim()), scrubNul(r.category), scrubNul(r.sku), scrubNul(r.barcode),
                  scrubNul(r.unit) ?? "pc", String(r.purchasePrice), String(r.sellingPrice), String(r.gstPercent),
                  String(r.minStock), scrubNul(r.supplier), scrubNul(r.description), match.id,
                ],
              );
              // refresh maps
              const post = { ...match, name: r.name.trim(), sku: r.sku || null, barcode: r.barcode || null };
              if (before.sku) ctx.anySku.delete(String(before.sku));
              if (before.barcode) ctx.anyBarcode.delete(String(before.barcode));
              if (post.sku) ctx.anySku.set(String(post.sku), post);
              if (post.barcode) ctx.anyBarcode.set(String(post.barcode), post);
              updated++;
              continue;
            }

            if (match) {
              skipped++;
              continue;
            }

            if (productLimit != null && productLimit > 0 && activeProductCount >= productLimit) {
              throw ApiError.forbidden(`Your plan allows up to ${productLimit} active products.`);
            }

            const created = await tx.qOne<Row>(
              `INSERT INTO products
                 (store_id, name, barcode, sku, category, unit, purchase_price, selling_price,
                  gst_percent, min_stock, supplier, description)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               RETURNING *`,
              [
                storeId, scrubNul(r.name.trim()), scrubNul(r.barcode), scrubNul(r.sku), scrubNul(r.category),
                scrubNul(r.unit) ?? "pc", String(r.purchasePrice), String(r.sellingPrice), String(r.gstPercent),
                String(r.minStock), scrubNul(r.supplier), scrubNul(r.description),
              ],
            );
            if (!created) throw new Error("Import insert failed");
            activeProductCount += 1;
            if (r.openingStock > 0) {
              await createStockMovement(tx, {
                productId: created.id as string,
                storeId,
                qty: r.openingStock,
                type: "OPENING",
                referenceType: "OPENING",
                note: "Opening stock (bulk import)",
                createdById: user.id,
              });
            }
            if (r.sku) ctx.anySku.set(String(r.sku), created);
            if (r.barcode) ctx.anyBarcode.set(String(r.barcode), created);
            if (!r.sku && !r.barcode) ctx.activeNameKeys.set(normalizeName(String(r.name)), created);
            imported++;
          } catch (err) {
            if (isUniqueViolation(err)) {
              failed++;
              errors.push({
                index: i,
                message: `${rawName}: conflicts with an existing product (SKU/barcode/name)`,
              });
              continue;
            }
            throw err;
          }
        }

        return { imported, updated, skipped, failed, errors };
      });

      logger.info("products: bulk import", {
        storeId, userId: user.id,
        imported: result.imported, updated: result.updated, skipped: result.skipped, failed: result.failed,
      });
      return { ...result, mode: body.mode, summary: await computeSummary(storeId) };
    },
  );

  // PDF text extraction (bulk import helper)
  app.post("/import/pdf", { preHandler: [authenticate, managerOnly] }, async (request: AuthenticatedRequest) => {
    const part = await request.file();
    if (!part) throw ApiError.badRequest("No file uploaded. Send a PDF file as multipart/form-data.");
    const buf = await part.toBuffer();
    if (!part.filename.toLowerCase().endsWith(".pdf")) {
      throw ApiError.badRequest("Only PDF files are supported.");
    }
    const result = extractPdfText(buf);
    const lines: string[] = [];
    for (const line of result.lines ?? []) {
      const clean = sanitizeExtractedLine(line);
      if (clean) lines.push(clean);
    }
    return { ...result, lines };
  });

  // Google Sheets import (published CSV export)
  app.post("/import/sheets", { preHandler: [authenticate, managerOnly] }, async (request: AuthenticatedRequest) => {
    const { url } = parse(z.object({ url: z.string().url().max(500) }), request.body);
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) throw ApiError.badRequest("Invalid Google Sheets URL.");
    const gidMatch = url.match(/[?#&]gid=(\d+)/);
    const exportUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ""}`;
    let res: Response;
    try {
      res = await fetch(exportUrl, { headers: { "User-Agent": "MiDukandar" } });
    } catch {
      throw ApiError.badRequest("Could not reach Google Sheets. Check your network connection.");
    }
    if (!res.ok) {
      throw ApiError.badRequest(
        "Could not read the sheet. Make sure it is shared publicly with 'Anyone with the link' view access.",
      );
    }
    const text = await res.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      return { columns: [], rows: [], message: "The sheet appears to be empty or has no data rows." };
    }
    return { columns: parsed[0], rows: parsed.slice(1).slice(0, 5000) };
  });
}
