import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, dateRangeSchema } from "../lib/validate.js";
import { authenticate, requireStore, type AuthenticatedRequest } from "../middlewares/auth.js";
import {
  getDashboardStats,
  getSalesReport,
  getPurchaseReport,
  getCurrentStock,
  getGstReport,
  getPnlReport,
  getStockMovementReport,
} from "../services/report.service.js";
import { q, qOne, qClient } from "../db/pool.js";
import { boolFilter } from "./product.shared.js";
import { istBoundary, istDayEnd, istDayStart } from "../lib/ist.js";

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  // Day boundaries are IST, not the server's UTC day: a report for "today"
  // must cover 00:00–23:59:59.999 IST, otherwise early-morning transactions
  // fall into the previous UTC day.
  const fromDate = from ? istBoundary(from, false) : istDayStart();
  const toDate = to ? istBoundary(to, true) : istDayEnd();

  return { from: fromDate, to: toDate };
}

const stockQuerySchema = z.object({
  lowOnly: boolFilter(false),
  search: z.string().optional(),
});

const stockMovementQuerySchema = dateRangeSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
});

export async function reportRoutes(app: FastifyInstance) {
  // Dashboard summary (+ date range filter)
  app.get("/dashboard", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(dateRangeSchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const stats = await getDashboardStats(qClient(), storeId, from, to);
    return { stats, from: from.toISOString(), to: to.toISOString() };
  });

  // Sales report (date-wise rows with invoice drill-down)
  app.get("/sales", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(dateRangeSchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const rows = await getSalesReport(qClient(), storeId, from, to);
    const totals = rows.reduce(
      (acc, r) => ({
        invoices: acc.invoices + r.invoiceCount,
        subtotal: acc.subtotal + r.subtotal,
        discount: acc.discount + r.discount,
        tax: acc.tax + r.tax,
        total: acc.total + r.total,
      }),
      { invoices: 0, subtotal: 0, discount: 0, tax: 0, total: 0 },
    );
    return { rows, totals, from: from.toISOString(), to: to.toISOString() };
  });

  // Purchase report (merged from purchase_orders + legacy purchases)
  app.get("/purchases", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(dateRangeSchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const rows = await getPurchaseReport(qClient(), storeId, from, to);
    const totals = rows.reduce(
      (acc, r) => ({
        purchases: acc.purchases + r.purchaseCount,
        subtotal: acc.subtotal + r.subtotal,
        tax: acc.tax + r.tax,
        total: acc.total + r.total,
      }),
      { purchases: 0, subtotal: 0, tax: 0, total: 0 },
    );
    return { rows, totals, from: from.toISOString(), to: to.toISOString() };
  });

  // Current stock list
  app.get("/stock/current", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(stockQuerySchema, request.query);
    const stock = await getCurrentStock(qClient(), storeId, { lowOnly: query.lowOnly, search: query.search });
    const totalValue = stock.reduce((acc, r) => acc + r.balance * r.purchasePrice, 0);
    return { stock, totalValue };
  });

  // Stock movement report (opening / in / out / closing per product in date range)
  app.get("/stock/movements", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(stockMovementQuerySchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const rows = await getStockMovementReport(qClient(), storeId, from, to, {
      search: query.search,
      category: query.category,
    });
    const totalValuation = rows.reduce((s, r) => s + r.valuation, 0);
    return { rows, totalValuation, from: from.toISOString(), to: to.toISOString() };
  });

  // GST Summary report
  app.get("/gst", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(dateRangeSchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const data = await getGstReport(qClient(), storeId, from, to);
    return { ...data, from: from.toISOString(), to: to.toISOString() };
  });

  // P&L Summary report
  app.get("/pnl", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(dateRangeSchema, request.query);
    const { from, to } = resolveRange(query.from, query.to);
    const data = await getPnlReport(qClient(), storeId, from, to);
    return { ...data, from: from.toISOString(), to: to.toISOString() };
  });
}