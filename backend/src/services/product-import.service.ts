import { z } from "zod";
import type { DbClient, Row } from "../db/pool.js";

export const importRowSchema = z.object({
  name: z.string().min(1).max(150),
  category: z.string().max(80).optional().default(""),
  sku: z.string().max(64).optional().default(""),
  barcode: z.string().max(64).optional().default(""),
  unit: z.string().max(16).optional().default("pc"),
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  minStock: z.coerce.number().min(0).default(0),
  openingStock: z.coerce.number().min(0).default(0),
  supplier: z.string().max(150).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dupKeyOf(r: ImportRow): string {
  return r.sku ? `sku:${r.sku}` : r.barcode ? `barcode:${r.barcode}` : `name:${normalizeName(r.name)}`;
}

// Bundle/certificate blobs and binary junk routinely leak out of PDF text
// extraction as "lines". Reject rows that are clearly not human-readable names.

const BINARY_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const HEADER_TERMS = new Set([
  "product", "item", "name", "particulars", "description", "rate", "qty", "quantity",
  "hsn", "gst", "tax", "amount", "price", "purchase", "selling", "sale", "stock",
  "category", "sku", "barcode", "unit", "actions", "no", "net", "gross", "total",
  "date", "invoice", "serial",
]);

export function unreadableNameReason(name: string): string | null {
  const s = String(name ?? "").replace(/\u0000/g, "").trim();
  if (!s) return "Product name is required";
  if (BINARY_CHARS.test(s)) return "contains binary/unreadable characters (extraction junk)";
  if ((s.match(/[\p{L}]/gu) ?? []).length === 0) return "has no readable letters, only symbols/numbers";
  if (s.length >= 48 && !/\s/.test(s)) {
    const symbolCount = s.replace(/[\p{L}\p{N}]/gu, "").length;
    if (symbolCount >= 4) return "looks like encoded/binary data, not a product name";
  }
  return null;
}

export function sanitizeExtractedLine(line: string): string | null {
  const s = String(line ?? "").replace(/\u0000/g, "").trim();
  if (!s) return null;
  if (BINARY_CHARS.test(s)) return null;
  if (unreadableNameReason(s)) return null;
  const tokens = s
    .toLowerCase()
    .split(/[\s\t|,;:]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (tokens.length >= 2 && tokens.every((t) => HEADER_TERMS.has(t))) return null; // table header row
  return s;
}

export interface ImportContext {
  activeNameKeys: Map<string, Row>;
  activeBarcodeKeys: Map<string, Row>;
  activeSkuKeys: Map<string, Row>;
  anyBarcode: Map<string, Row>;
  anySku: Map<string, Row>;
}

/** Loads the store's product dedupe maps (name/SKU/barcode keys). */
export async function loadImportContext(db: DbClient, storeId: string): Promise<ImportContext> {
  const existing = await db.q<Row>(
    `SELECT id, name, sku, barcode, is_archived FROM products WHERE store_id = $1`,
    [storeId],
  );
  const activeNameKeys = new Map<string, Row>();
  const activeBarcodeKeys = new Map<string, Row>();
  const activeSkuKeys = new Map<string, Row>();
  const anyBarcode = new Map<string, Row>();
  const anySku = new Map<string, Row>();
  for (const p of existing) {
    const isActive = !p.isArchived;
    if (isActive && !p.sku && !p.barcode) activeNameKeys.set(normalizeName(String(p.name)), p);
    if (isActive && p.barcode) activeBarcodeKeys.set(String(p.barcode), p);
    if (isActive && p.sku) activeSkuKeys.set(String(p.sku), p);
    if (p.barcode) anyBarcode.set(String(p.barcode), p);
    if (p.sku) anySku.set(String(p.sku), p);
  }
  return { activeNameKeys, activeBarcodeKeys, activeSkuKeys, anyBarcode, anySku };
}

/** Finds the existing product a row would collide with, if any. */
export function resolveMatch(ctx: ImportContext, r: ImportRow): Row | null {
  if (r.sku) return ctx.anySku.get(String(r.sku)) ?? ctx.activeSkuKeys.get(String(r.sku)) ?? null;
  if (r.barcode) return ctx.anyBarcode.get(String(r.barcode)) ?? ctx.activeBarcodeKeys.get(String(r.barcode)) ?? null;
  return ctx.activeNameKeys.get(normalizeName(r.name)) ?? null;
}

export type ImportValidation =
  | { ok: true; product: ImportRow }
  | { ok: false; message: string; product: ImportRow | null };

/**
 * Runs the shared import-row pipeline: schema parse, name-required check and
 * legibility check. On failure it returns the error message plus the parsed
 * row when one exists (so previews can still echo the raw data).
 */
export function validateImportRow(raw: unknown): ImportValidation {
  const parsed = importRowSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((iss) => `${iss.path.join(".") || "row"}: ${iss.message}`)
      .join("; ");
    return { ok: false, message, product: null };
  }
  const r = parsed.data;
  if (!r.name.trim()) return { ok: false, message: "Product name is required", product: r };
  const nameIssue =
    unreadableNameReason(r.name) ??
    (sanitizeExtractedLine(r.name) === null ? "looks like a table header row, not a product" : null);
  if (nameIssue) return { ok: false, message: `Unreadable product name (${nameIssue})`, product: r };
  return { ok: true, product: r };
}