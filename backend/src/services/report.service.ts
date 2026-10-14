import type { DbClient } from "../db/pool.js";
import { ledgerBalanceExpr } from "./ledger.service.js";
import { getStockBalances, mapLow } from "./stock.service.js";

type Tx = DbClient;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface RecentTransaction {
  id: string;
  type: "SALE" | "PURCHASE" | "PAYMENT";
  number: string;
  party: string;
  amount: number;
  mode?: string;
  createdAt: Date;
}

export interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  todayExpenses: number;
  todayProfit: number;
  receivables: number;
  payables: number;
  lowStockCount: number;
  recentTransactions: RecentTransaction[];
}

export async function getDashboardStats(
  db: Tx,
  storeId: string,
  from?: Date,
  to?: Date,
): Promise<DashboardStats> {
  const start = from ?? new Date(new Date().setHours(0, 0, 0, 0));
  const end = to ?? new Date(new Date().setHours(23, 59, 59, 999));

  const [salesAgg, purchasesAgg, expensesAgg] = await Promise.all([
    db.qOne<{ t: number; s: number; tx: number }>(
      `SELECT COALESCE(SUM(paid_amount),0) AS t,
              COALESCE(SUM(CASE WHEN total > 0 THEN subtotal * (paid_amount / total) ELSE 0 END),0) AS s,
              COALESCE(SUM(CASE WHEN total > 0 THEN tax_total * (paid_amount / total) ELSE 0 END),0) AS tx
       FROM sales WHERE store_id=$1 AND status='CONFIRMED' AND created_at BETWEEN $2 AND $3`,
      [storeId, start, end],
    ),
    db.qOne<{ t: number }>(
      `SELECT COALESCE(SUM(total),0) AS t FROM purchases WHERE store_id=$1 AND created_at BETWEEN $2 AND $3`,
      [storeId, start, end],
    ),
    db.qOne<{ t: number }>(
      `SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE store_id=$1 AND expense_date BETWEEN $2::date AND $3::date`,
      [storeId, start.toISOString().split("T")[0], end.toISOString().split("T")[0]],
    ),
  ]);

  const [receivables, payables, lowStockCount] = await Promise.all([
    db.qOne<{ r: number }>(
      `SELECT COALESCE(${ledgerBalanceExpr()},0) AS r
       FROM ledger_entries WHERE store_id=$1`,
      [storeId],
    ),
    db.qOne<{ p: number }>(
      `SELECT COALESCE(SUM(due_amount),0) AS p FROM purchases
       WHERE store_id=$1 AND payment_status IN ('UNPAID','PARTIAL')`,
      [storeId],
    ),
    countLowStockProducts(db, storeId),
  ]);

  const recent = [
    ...(await db.q<RecentTransaction>(
      `SELECT s.id, 'SALE' AS type, s.invoice_number AS number,
              COALESCE(c.name,'Walk-in') AS party, s.total AS amount, s.payment_mode AS mode, s.created_at
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.store_id=$1 AND s.status='CONFIRMED' ORDER BY s.created_at DESC LIMIT 6`,
      [storeId],
    )),
    ...(await db.q<RecentTransaction>(
      `SELECT id, 'PURCHASE' AS type, purchase_number AS number, supplier_name AS party, total AS amount, NULL AS mode, created_at
       FROM purchases WHERE store_id=$1 ORDER BY created_at DESC LIMIT 4`,
      [storeId],
    )),
    ...(await db.q<RecentTransaction>(
      `SELECT p.id, 'PAYMENT' AS type, p.id::text AS number, COALESCE(c.name,'Payment') AS party, p.amount AS amount, p.mode AS mode, p.created_at
       FROM payments p LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.store_id=$1 ORDER BY p.created_at DESC LIMIT 4`,
      [storeId],
    )),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const salesRev = salesAgg?.t ?? 0;
  const salesCost = salesAgg?.s ?? 0;
  const salesTax = salesAgg?.tx ?? 0;
  const expensesCost = expensesAgg?.t ?? 0;

  return {
    todaySales: round2(salesRev),
    todayPurchases: round2(purchasesAgg?.t ?? 0),
    todayExpenses: round2(expensesCost),
    todayProfit: round2(salesRev - salesCost - salesTax - expensesCost),
    receivables: round2(receivables?.r ?? 0),
    payables: round2(payables?.p ?? 0),
    lowStockCount: lowStockCount,
    recentTransactions: recent.slice(0, 8),
  };
}

async function countLowStockProducts(db: Tx, storeId: string): Promise<number> {
  const rows = await db.q<{ id: string; min_stock: number }>(
    `SELECT p.id, p.min_stock
     FROM products p WHERE p.store_id=$1 AND p.is_archived=FALSE AND p.min_stock > 0`,
    [storeId],
  );
  const stocked = await mapLow(db, rows, storeId);
  return stocked.filter((r) => r.isLow).length;
}

// ────────────────────────────────────────────────────────────────────────────
// Sales Report
// ────────────────────────────────────────────────────────────────────────────

export interface SalesInvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  paymentMode: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
}

export interface SalesReportRow {
  date: string;
  invoiceCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  invoices: SalesInvoiceRow[];
}

export async function getSalesReport(db: Tx, storeId: string, from: Date, to: Date): Promise<SalesReportRow[]> {
  // Date-wise aggregates
  const dateRows = await db.q<{
    d: string; c: number; s: number; disc: number; tx: number; t: number;
  }>(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
            COUNT(*) AS c, COALESCE(SUM(subtotal),0) AS s, COALESCE(SUM(discount),0) AS disc,
            COALESCE(SUM(tax_total),0) AS tx, COALESCE(SUM(total),0) AS t
     FROM sales WHERE store_id=$1 AND status='CONFIRMED' AND created_at BETWEEN $2 AND $3
     GROUP BY d ORDER BY d`,
    [storeId, from, to],
  );

  if (dateRows.length === 0) return [];

  // Invoice detail rows for the same range
  const invoiceRows = await db.q<{
    id: string; invoice_number: string; customer_name: string | null; payment_mode: string;
    subtotal: number; discount: number; tax_total: number; total: number;
    paid_amount: number; due_amount: number;
    d: string;
  }>(
    `SELECT s.id, s.invoice_number, COALESCE(c.name,'Walk-in') AS customer_name, s.payment_mode,
            s.subtotal, s.discount, s.tax_total, s.total, s.paid_amount, s.due_amount,
            to_char(s.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.store_id=$1 AND s.status='CONFIRMED' AND s.created_at BETWEEN $2 AND $3
     ORDER BY s.created_at`,
    [storeId, from, to],
  );

  // Group invoices by date
  const invoicesByDate = new Map<string, SalesInvoiceRow[]>();
  for (const r of invoiceRows) {
    if (!invoicesByDate.has(r.d)) invoicesByDate.set(r.d, []);
    invoicesByDate.get(r.d)!.push({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name ?? "Walk-in",
      paymentMode: r.payment_mode,
      subtotal: round2(Number(r.subtotal)),
      discount: round2(Number(r.discount)),
      tax: round2(Number(r.tax_total)),
      total: round2(Number(r.total)),
      paidAmount: round2(Number(r.paid_amount)),
      dueAmount: round2(Number(r.due_amount)),
    });
  }

  return dateRows.map((r) => ({
    date: r.d,
    invoiceCount: Number(r.c),
    subtotal: round2(Number(r.s)),
    discount: round2(Number(r.disc)),
    tax: round2(Number(r.tx)),
    total: round2(Number(r.t)),
    invoices: invoicesByDate.get(r.d) ?? [],
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Purchase Report
// ────────────────────────────────────────────────────────────────────────────

export interface PurchaseReportRow {
  date: string;
  purchaseCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export async function getPurchaseReport(db: Tx, storeId: string, from: Date, to: Date): Promise<PurchaseReportRow[]> {
  // Try purchase_orders table first (Suppliers module). purchase_orders only
  // stores total_amount; subtotal (pre-tax) and tax are derived from its line
  // items where line_total = gross + tax.
  const poRows = await db.q<{ d: string; c: number; s: number; tx: number; t: number }>(
    `SELECT d, COUNT(*) AS c,
            COALESCE(SUM(s),0) AS s, COALESCE(SUM(tx),0) AS tx, COALESCE(SUM(t),0) AS t
     FROM (
       SELECT to_char(po.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
              x.s AS s, x.tx AS tx, po.total_amount AS t
       FROM purchase_orders po
       LEFT JOIN (
         SELECT po_id, SUM(line_total / (1 + tax_rate / 100)) AS s,
                SUM(line_total - line_total / (1 + tax_rate / 100)) AS tx
         FROM purchase_order_items GROUP BY po_id
       ) x ON x.po_id = po.id
       WHERE po.store_id=$1 AND po.status IN ('received','sent') AND po.created_at BETWEEN $2 AND $3
     ) po_daily GROUP BY d ORDER BY d`,
    [storeId, from, to],
  );

  // Also aggregate from legacy purchases table
  const legacyRows = await db.q<{ d: string; c: number; s: number; tx: number; t: number }>(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
            COUNT(*) AS c, COALESCE(SUM(subtotal),0) AS s, COALESCE(SUM(tax_total),0) AS tx, COALESCE(SUM(total),0) AS t
     FROM purchases WHERE store_id=$1 AND created_at BETWEEN $2 AND $3
     GROUP BY d ORDER BY d`,
    [storeId, from, to],
  );

  // Merge both sources by date
  const merged = new Map<string, { c: number; s: number; tx: number; t: number }>();
  for (const r of [...poRows, ...legacyRows]) {
    const existing = merged.get(r.d);
    if (existing) {
      existing.c += Number(r.c);
      existing.s += Number(r.s);
      existing.tx += Number(r.tx);
      existing.t += Number(r.t);
    } else {
      merged.set(r.d, { c: Number(r.c), s: Number(r.s), tx: Number(r.tx), t: Number(r.t) });
    }
  }

  return Array.from(merged.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      purchaseCount: v.c,
      subtotal: round2(v.s),
      tax: round2(v.tx),
      total: round2(v.t),
    }));
}

// ────────────────────────────────────────────────────────────────────────────
// Stock Current / Movement Report
// ────────────────────────────────────────────────────────────────────────────

export interface StockRow {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit: string;
  balance: number;
  minStock: number;
  isLow: boolean;
  sellingPrice: number;
  purchasePrice: number;
  imageUrl?: string;
}

export async function getCurrentStock(
  db: Tx,
  storeId: string,
  opts: { lowOnly?: boolean; search?: string } = {},
): Promise<StockRow[]> {
  const params: unknown[] = [storeId];
  let search = "";
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    search = ` AND lower(p.name) LIKE $${params.length}`;
  }
  const products = await db.q<{
    id: string; name: string; sku: string | null; barcode: string | null; category: string | null;
    unit: string; min_stock: number; selling_price: number; purchase_price: number; image_url: string | null;
  }>(
    `SELECT id, name, sku, barcode, category, unit, min_stock, selling_price, purchase_price, image_url
     FROM products WHERE store_id=$1 AND is_archived=FALSE${search} ORDER BY lower(name)`,
    params,
  );
  const balances = await getStockBalances(db, products.map((p) => p.id), storeId);

  const rows: StockRow[] = products.map((p) => {
    const balance = balances[p.id] ?? 0;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku ?? undefined,
      barcode: p.barcode ?? undefined,
      category: p.category ?? undefined,
      unit: p.unit,
      balance,
      minStock: Number(p.min_stock),
      isLow: balance < Number(p.min_stock),
      sellingPrice: Number(p.selling_price),
      purchasePrice: Number(p.purchase_price),
      imageUrl: p.image_url ?? undefined,
    };
  });

  return opts.lowOnly ? rows.filter((r) => r.isLow) : rows.sort((a, b) => a.balance - b.balance);
}

export interface StockMovementReportRow {
  productId: string;
  productName: string;
  sku?: string;
  category?: string;
  unit: string;
  purchasePrice: number;
  openingQty: number;
  stockIn: number;
  stockOut: number;
  closingQty: number;
  valuation: number;
}

export async function getStockMovementReport(
  db: Tx,
  storeId: string,
  from: Date,
  to: Date,
  opts: { search?: string; category?: string } = {},
): Promise<StockMovementReportRow[]> {
  const params: unknown[] = [storeId];
  let searchClause = "";
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    searchClause += ` AND lower(p.name) LIKE $${params.length}`;
  }
  if (opts.category) {
    params.push(opts.category);
    searchClause += ` AND p.category = $${params.length}`;
  }

  const products = await db.q<{
    id: string; name: string; sku: string | null; category: string | null; unit: string; purchase_price: number;
  }>(
    `SELECT id, name, sku, category, unit, purchase_price
     FROM products WHERE store_id=$1 AND is_archived=FALSE${searchClause} ORDER BY lower(name)`,
    params,
  );

  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  // Opening balance: sum all movements strictly BEFORE `from`
  const openingRows = await db.q<{ product_id: string; qty: number }>(
    `SELECT product_id, COALESCE(SUM(qty), 0) AS qty
     FROM stock_movements WHERE store_id=$1 AND product_id = ANY($2::uuid[]) AND created_at < $3
     GROUP BY product_id`,
    [storeId, productIds, from],
  );
  const openingMap = new Map<string, number>();
  for (const r of openingRows) openingMap.set(r.product_id, Number(r.qty));

  // In-range movements
  const rangeRows = await db.q<{ product_id: string; qty: number; type: string }>(
    `SELECT product_id, qty, type
     FROM stock_movements WHERE store_id=$1 AND product_id = ANY($2::uuid[]) AND created_at BETWEEN $3 AND $4`,
    [storeId, productIds, from, to],
  );

  // Aggregate in/out per product
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();
  for (const r of rangeRows) {
    const qty = Number(r.qty);
    if (qty > 0) {
      inMap.set(r.product_id, (inMap.get(r.product_id) ?? 0) + qty);
    } else {
      outMap.set(r.product_id, (outMap.get(r.product_id) ?? 0) + Math.abs(qty));
    }
  }

  return products.map((p) => {
    const openingQty = openingMap.get(p.id) ?? 0;
    const stockIn = inMap.get(p.id) ?? 0;
    const stockOut = outMap.get(p.id) ?? 0;
    const closingQty = openingQty + stockIn - stockOut;
    const purchasePrice = Number(p.purchase_price);
    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? undefined,
      category: p.category ?? undefined,
      unit: p.unit,
      purchasePrice,
      openingQty: round2(openingQty),
      stockIn: round2(stockIn),
      stockOut: round2(stockOut),
      closingQty: round2(closingQty),
      valuation: round2(closingQty * purchasePrice),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// GST Summary Report
// ────────────────────────────────────────────────────────────────────────────

export interface GstRateBreakup {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  invoiceCount: number;
}

export interface Gstr1InvoiceRow {
  invoiceNumber: string;
  date: string;
  customerName: string;
  gstin: string | null;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  total: number;
}

export interface GstReportResponse {
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  rateBreakup: GstRateBreakup[];
  invoices: Gstr1InvoiceRow[];
}

export async function getGstReport(
  db: Tx,
  storeId: string,
  from: Date,
  to: Date,
): Promise<GstReportResponse> {
  // Per-sale, per-rate tax aggregation from sale_items
  const itemRows = await db.q<{
    invoice_number: string;
    sale_date: string;
    customer_name: string | null;
    gstin: string | null;
    gst_percent: number;
    taxable_value: number;
    tax_amount: number;
    total: number;
  }>(
    `SELECT s.invoice_number,
            to_char(s.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS sale_date,
            COALESCE(c.name,'Walk-in') AS customer_name,
            c.gst AS gstin,
            COALESCE(si.gst_percent, 0) AS gst_percent,
            COALESCE(SUM((si.unit_price - si.discount) * si.qty), 0) AS taxable_value,
            COALESCE(SUM(si.tax_amount), 0) AS tax_amount,
            COALESCE(SUM(si.line_total), 0) AS total
     FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN sale_items si ON si.sale_id = s.id
     WHERE s.store_id=$1 AND s.status='CONFIRMED' AND s.created_at BETWEEN $2 AND $3
     GROUP BY s.id, s.invoice_number, s.created_at, c.name, c.gst, si.gst_percent
     ORDER BY s.created_at, si.gst_percent`,
    [storeId, from, to],
  );

  // Group by invoice+rate to build GSTR-1 rows
  const invoiceMap = new Map<string, Gstr1InvoiceRow>();
  const rateMap = new Map<number, GstRateBreakup>();

  for (const r of itemRows) {
    const rate = Number(r.gst_percent);
    const taxable = round2(Number(r.taxable_value));
    const taxAmount = round2(Number(r.tax_amount));
    const total = round2(Number(r.total));
    // Assume intra-state (CGST+SGST split); if you need inter-state logic, check store state vs customer state
    const cgst = round2(taxAmount / 2);
    const sgst = round2(taxAmount - cgst);
    const igst = 0;

    const key = `${r.invoice_number}__${rate}`;
    const existing = invoiceMap.get(key);
    if (existing) {
      existing.taxableValue = round2(existing.taxableValue + taxable);
      existing.cgst = round2(existing.cgst + cgst);
      existing.sgst = round2(existing.sgst + sgst);
      existing.taxAmount = round2(existing.taxAmount + taxAmount);
      existing.total = round2(existing.total + total);
    } else {
      invoiceMap.set(key, {
        invoiceNumber: r.invoice_number,
        date: r.sale_date,
        customerName: r.customer_name ?? "Walk-in",
        gstin: r.gstin,
        taxableValue: taxable,
        gstRate: rate,
        cgst,
        sgst,
        igst,
        taxAmount,
        total,
      });
    }

    // Accumulate rate breakup
    const rb = rateMap.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceCount: 0 };
    rb.taxableValue = round2(rb.taxableValue + taxable);
    rb.cgst = round2(rb.cgst + cgst);
    rb.sgst = round2(rb.sgst + sgst);
    rb.totalTax = round2(rb.totalTax + taxAmount);
    rb.invoiceCount += 1;
    rateMap.set(rate, rb);
  }

  const invoices = Array.from(invoiceMap.values());
  const rateBreakup = Array.from(rateMap.values()).sort((a, b) => a.rate - b.rate);

  const totalTaxableValue = round2(invoices.reduce((s, r) => s + r.taxableValue, 0));
  const totalCgst = round2(invoices.reduce((s, r) => s + r.cgst, 0));
  const totalSgst = round2(invoices.reduce((s, r) => s + r.sgst, 0));
  const totalIgst = 0;
  const totalTax = round2(invoices.reduce((s, r) => s + r.taxAmount, 0));

  return { totalTaxableValue, totalCgst, totalSgst, totalIgst, totalTax, rateBreakup, invoices };
}

// ────────────────────────────────────────────────────────────────────────────
// P&L Summary Report
// ────────────────────────────────────────────────────────────────────────────

export interface PnlTrendRow {
  period: string; // YYYY-MM-DD or YYYY-MM
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export interface PnlReportResponse {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
  trend: PnlTrendRow[];
}

export async function getPnlReport(
  db: Tx,
  storeId: string,
  from: Date,
  to: Date,
): Promise<PnlReportResponse> {
  // Revenue from confirmed sales (paid amount)
  const salesRows = await db.q<{
    d: string;
    revenue: number;
    subtotal: number;
    tax: number;
    total: number;
  }>(
    `SELECT to_char(s.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
            COALESCE(SUM(s.total), 0) AS revenue,
            COALESCE(SUM(s.subtotal), 0) AS subtotal,
            COALESCE(SUM(s.tax_total), 0) AS tax,
            COALESCE(SUM(s.total), 0) AS total
     FROM sales s WHERE s.store_id=$1 AND s.status='CONFIRMED' AND s.created_at BETWEEN $2 AND $3
     GROUP BY d ORDER BY d`,
    [storeId, from, to],
  );

  // COGS: sum of (qty * purchase_price) for each sold item
  const cogsRows = await db.q<{ d: string; cogs: number }>(
    `SELECT to_char(s.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
            COALESCE(SUM(si.qty * p.purchase_price), 0) AS cogs
     FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN products p ON p.id = si.product_id
     WHERE s.store_id=$1 AND s.status='CONFIRMED' AND s.created_at BETWEEN $2 AND $3
     GROUP BY d ORDER BY d`,
    [storeId, from, to],
  );

  // Expenses per day
  const expenseRows = await db.q<{ d: string; expenses: number }>(
    `SELECT expense_date::text AS d, COALESCE(SUM(amount), 0) AS expenses
     FROM expenses WHERE store_id=$1 AND expense_date BETWEEN $2::date AND $3::date
     GROUP BY d ORDER BY d`,
    [storeId, from.toISOString().split("T")[0], to.toISOString().split("T")[0]],
  );

  // Merge by date
  const revenueMap = new Map<string, number>();
  const cogsMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const r of salesRows) revenueMap.set(r.d, round2(Number(r.revenue)));
  for (const r of cogsRows) cogsMap.set(r.d, round2(Number(r.cogs)));
  for (const r of expenseRows) expenseMap.set(r.d, round2(Number(r.expenses)));

  // Collect all dates
  const allDates = Array.from(new Set([
    ...revenueMap.keys(),
    ...cogsMap.keys(),
    ...expenseMap.keys(),
  ])).sort();

  const trend: PnlTrendRow[] = allDates.map((d) => {
    const revenue = revenueMap.get(d) ?? 0;
    const cogs = cogsMap.get(d) ?? 0;
    const expenses = expenseMap.get(d) ?? 0;
    const grossProfit = round2(revenue - cogs);
    const netProfit = round2(grossProfit - expenses);
    return { period: d, revenue, cogs, grossProfit, expenses, netProfit };
  });

  const revenue = round2(trend.reduce((s, r) => s + r.revenue, 0));
  const cogs = round2(trend.reduce((s, r) => s + r.cogs, 0));
  const expenses = round2(trend.reduce((s, r) => s + r.expenses, 0));
  const grossProfit = round2(revenue - cogs);
  const netProfit = round2(grossProfit - expenses);

  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
    expenses,
    netProfit,
    netMarginPct: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
    trend,
  };
}