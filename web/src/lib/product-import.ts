export interface ProductImportRow {
  name?: string;
  category?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  gstPercent?: number;
  minStock?: number;
  openingStock?: number;
  supplier?: string;
  description?: string;
}

const CSV_COLUMNS = [
  "product_name",
  "category",
  "sku",
  "barcode",
  "unit",
  "purchase_price",
  "selling_price",
  "gst_percent",
  "opening_stock",
  "low_stock_threshold",
  "description",
] as const;

const FIELD_ALIASES: Record<string, string> = {
  name: "name",
  product_name: "name",
  productname: "name",
  "product name": "name",
  category: "category",
  sku: "sku",
  barcode: "barcode",
  unit: "unit",
  purchase_price: "purchasePrice",
  purchaseprice: "purchasePrice",
  "purchase price": "purchasePrice",
  cost_price: "purchasePrice",
  selling_price: "sellingPrice",
  sellingprice: "sellingPrice",
  "selling price": "sellingPrice",
  sale_price: "sellingPrice",
  mrp: "mrp",
  price: "sellingPrice",
  gst_percent: "gstPercent",
  gst: "gstPercent",
  "gst %": "gstPercent",
  min_stock: "minStock",
  low_stock_threshold: "minStock",
  minstock: "minStock",
  opening_stock: "openingStock",
  openingstock: "openingStock",
  opening: "openingStock",
  supplier: "supplier",
  description: "description",
};

const NUMERIC_FIELDS = new Set(["purchasePrice", "sellingPrice", "mrp", "gstPercent", "minStock", "openingStock"]);

function toNumber(v: string): number | undefined {
  if (v == null) return undefined;
  const clean = String(v).trim().replace(/[₹,\s]/g, "");
  if (clean === "" || clean === "-") return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

/** Robust CSV parser - handles quoted fields, escaped quotes, and CRLF. */
function parseCsvFile(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  const len = src.length;
  for (let i = 0; i < len; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Maps a header row + grid into product import rows (blank rows skipped). */
export function gridToRows(columns: string[], data: string[][], maxRows = 2000): ProductImportRow[] {
  const map: string[] = [];
  for (const col of columns) {
    const key = String(col ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    map.push(FIELD_ALIASES[key] ?? "");
  }
  const out: ProductImportRow[] = [];
  for (const raw of data.slice(0, maxRows)) {
    const row: ProductImportRow = {};
    let hasContent = false;
    for (let i = 0; i < map.length; i++) {
      const key = map[i];
      if (!key) continue;
      const value = (raw[i] ?? "").trim();
      if (key === "name") {
        if (value) {
          row.name = value;
          hasContent = true;
        }
        continue;
      }
      if (NUMERIC_FIELDS.has(key)) {
        const n = toNumber(value);
        if (n != null) {
          (row as unknown as Record<string, number>)[key] = n;
          hasContent = true;
        }
        continue;
      }
      if (value) {
        (row as unknown as Record<string, string>)[key] = value;
        hasContent = true;
      }
    }
    if (hasContent) out.push(row);
  }
  return out;
}

/** Parse CSV text directly into import rows (skips # comment lines and headers it can't map). */
export function csvToRows(text: string): ProductImportRow[] {
  const clean = text
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
  const grid = parseCsvFile(clean);
  if (grid.length === 0) return [];
  const first = grid[0];
  const hasHeader = first.some((c) => {
    const k = c.trim().toLowerCase().replace(/\s+/g, " ");
    return FIELD_ALIASES[k] === "name" || FIELD_ALIASES[k] === "sku";
  });
  const columns = hasHeader ? first : CSV_COLUMNS.slice(0, first.length).map((c) => String(c));
  const data = hasHeader ? grid.slice(1) : grid;
  return gridToRows(columns, data);
}

// --- PDF-extracted line sanity -------------------------------------------------
// PDF text extraction can leak embedded binary/certificate blobs as "lines".
// Reject anything that is clearly not a human-readable product name.

const BINARY_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

const HEADER_TERMS = new Set([
  "product", "item", "name", "particulars", "description", "rate", "qty", "quantity",
  "hsn", "gst", "tax", "amount", "price", "purchase", "selling", "sale", "stock",
  "category", "sku", "barcode", "unit", "actions", "no", "net", "gross", "total",
  "date", "invoice", "serial",
]);

/** True if the line is readable human text (letters present, no binary junk). */
function extractedLineIsReadable(line: string): boolean {
  const s = String(line ?? "").replace(/\u0000/g, "").trim();
  if (!s) return false;
  if (BINARY_CHARS.test(s)) return false;
  if ((s.match(/[\p{L}]/gu) ?? []).length === 0) return false;
  if (s.length >= 48 && !/\s/.test(s)) {
    const symbolCount = s.replace(/[\p{L}\p{N}]/gu, "").length;
    if (symbolCount >= 4) return false;
  }
  return true;
}

/** True if the line is only table-header words (e.g. "Product · Purchase · GST"). */
function extractedLineIsHeader(line: string): boolean {
  const tokens = String(line ?? "")
    .toLowerCase()
    .split(/[\s\t|,;:]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  return tokens.length >= 2 && tokens.every((t) => HEADER_TERMS.has(t));
}

/** Returns a clean usable line, or null if it is binary junk / a header row. */
export function cleanExtractedLine(line: string): string | null {
  const s = String(line ?? "").replace(/\u0000/g, "").trim();
  if (!extractedLineIsReadable(s)) return null;
  if (extractedLineIsHeader(s)) return null;
  return s;
}