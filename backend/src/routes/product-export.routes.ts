/**
 * Product export and import-template downloads: CSV, XLSX and PDF, driven by
 * the same filters as the product list. Registered by productRoutes before the
 * core routes so the static `/export/*` and `/template*` paths are never
 * captured by `GET /:id`.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { qOne, qClient, type Row } from "../db/pool.js";
import { parse } from "../lib/validate.js";
import {
  authenticate, requireStore, getAuth, type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { generateProductXlsx, generateTemplateXlsx, type ProductRow } from "../lib/xlsx.js";
import { generateProductPdf } from "../lib/pdf.js";
import { applyRoleCost, fetchFilteredRows, filterSchema } from "./product.shared.js";

const TSV_HEADERS = [
  "Product Name", "Category", "SKU", "Barcode", "Unit", "Purchase Price",
  "Selling Price", "GST %", "Opening Stock", "Low Stock Threshold", "Description",
];

const CSV_HEADERS = [
  "product_name", "category", "sku", "barcode", "unit", "purchase_price",
  "selling_price", "gst_percent", "opening_stock", "low_stock_threshold", "description",
];

function buildExportRows(rows: Row[]): ProductRow[] {
  return rows.map((r, i) => {
    const f = (v: unknown) => Number(v ?? 0);
    const stock = f(r.stock);
    const min = f(r.min_stock);
    const status = stock <= 0 ? "Out of Stock" : stock < min ? "Low Stock" : "In Stock";
    return {
      index: i + 1,
      name: String(r.name ?? ""),
      category: r.category ? String(r.category) : "",
      sku: r.sku ? String(r.sku) : "",
      barcode: r.barcode ? String(r.barcode) : "",
      unit: String(r.unit ?? "pc"),
      purchasePrice: f(r.purchasePrice),
      sellingPrice: f(r.sellingPrice),
      gstPercent: f(r.gstPercent),
      minStock: min,
      stock,
      status,
      createdAt: r.createdAt ? String(r.createdAt) : "",
      updatedAt: r.updatedAt ? String(r.updatedAt) : "",
      archivedAt: r.archivedAt ? String(r.archivedAt) : undefined,
      archivedBy: r.archivedByName ? String(r.archivedByName) : undefined,
    };
  });
}

function queryTitle(request: AuthenticatedRequest): string {
  const q = request.query as Record<string, unknown>;
  return "archived" in q && q.archived === true ? "Archived Product Report" : "Product Report";
}

declare module "fastify" {
  interface FastifyRequest {
    storeName?: string;
  }
}

export async function productExportRoutes(app: FastifyInstance) {
  // CSV / Excel template download
  app.get("/template.csv", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const instructions = [
      `# MiDukandar product import template`,
      `# Required column: product_name. Prices are in INR. GST % between 0 and 100.`,
      `# product_name,category,sku,barcode,unit,purchase_price,selling_price,gst_percent,opening_stock,low_stock_threshold,description`,
    ];
    const example = [
      "Parle-G Biscuits,Grocery,PRL-G500,8901063105991,pc,20,25,12,50,10,Example product",
    ];
    const csvText = instructions.join("\n") + "\n" + CSV_HEADERS.join(",") + "\n" +
      example.join(",") + "\n";
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="products-template.csv"');
    return reply.send(Buffer.from(csvText, "utf8"));
  });

  app.get("/template", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.redirect("/api/products/template.csv");
  });

  app.get("/template.xlsx", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const example = [
      "Parle-G Biscuits", "Grocery", "PRL-G500", "8901063105991", "pc",
      "20", "25", "12", "50", "10", "Example product - replace or delete this row",
    ];
    const buf = generateTemplateXlsx(TSV_HEADERS, example);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", 'attachment; filename="products-template.xlsx"');
    return reply.send(buf);
  });

  // Export current (filtered) products
  const exportCommon = async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(filterSchema, request.query);
    const { rows, summary } = await fetchFilteredRows(qClient(), storeId, query);
    applyRoleCost(rows, getAuth(request).role);
    const store = await qOne<Row>(`SELECT name FROM stores WHERE id = $1`, [storeId]);
    request.storeName = store?.name ? String(store.name) : "My Store";
    return { rows, summary };
  };

  app.get("/export/pdf", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { rows, summary } = await exportCommon(request);
    const pdfData = {
      storeName: request.storeName ?? "My Store",
      generatedAt: new Date().toLocaleString("en-IN"),
      title: queryTitle(request),
      subtitle: (request.query as Record<string, unknown>).archived === "true" ? "Archived Products" : "All Products",
      total: summary.total,
      active: summary.active,
      low: summary.low,
      out: summary.out,
      rows: buildExportRows(rows).map((r) => ({
        name: r.name,
        category: r.category,
        sku: r.sku,
        barcode: r.barcode,
        purchasePrice: r.purchasePrice.toFixed(2),
        sellingPrice: r.sellingPrice.toFixed(2),
        gstPercent: String(r.gstPercent),
        stock: String(r.stock),
        status: r.status,
      })),
    };
    const buf = await generateProductPdf(pdfData);
    reply.header("Content-Type", "application/pdf");
    const archived = (request.query as Record<string, unknown>).archived === "true";
    reply.header("Content-Disposition", `attachment; filename="${archived ? "archived" : "products"}-report.pdf"`);
    return reply.send(buf);
  });

  app.get("/export/xlsx", { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { rows, summary } = await exportCommon(request);
    const archived = (request.query as Record<string, unknown>).archived === "true";
    const buf = generateProductXlsx(buildExportRows(rows), {
      storeName: request.storeName ?? "My Store",
      date: new Date().toLocaleString("en-IN"),
      total: summary.total,
      active: summary.active,
      low: summary.low,
      out: summary.out,
    }, { archived });
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="${archived ? "archived" : "products"}.xlsx"`);
    return reply.send(buf);
  });
}
