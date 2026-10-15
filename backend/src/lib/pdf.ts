import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";

const RUPEE = "\u20B9";

function formatCurrencyValue(value: string | number | undefined): string {
  const normalized = String(value ?? "0").replace(/^\s*₹\s*/, "").replace(/[,\s]/g, "");
  return `${RUPEE}${normalized}`;
}

function resolvePdfFonts() {
  const regularCandidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf",
  ];
  const boldCandidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
  ];

  const regular = regularCandidates.find((candidate) => existsSync(candidate));
  const bold = boldCandidates.find((candidate) => existsSync(candidate)) ?? regular;

  if (!regular) return null;
  return { regular, bold: bold ?? regular };
}

export interface InvoiceLine {
  name: string;
  qty: string;
  price: string;
  amount: string;
}

export interface InvoiceData {
  storeName: string;
  storeType?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGst?: string;
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  items: InvoiceLine[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paid: string;
  due: string;
  paymentMode: string;
  /** Expected payment date (udhaar invoices only). */
  dueDate?: string;
  notes?: string;
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const fonts = resolvePdfFonts();
    const pdfFont = fonts ? "InvoiceSans" : "Helvetica";
    const pdfBoldFont = fonts ? "InvoiceSansBold" : "Helvetica-Bold";

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fonts) {
      doc.registerFont("InvoiceSans", fonts.regular);
      doc.registerFont("InvoiceSansBold", fonts.bold);
    }

    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;

    // ─── COLORS ────────────────────────────────────────────
    const GREEN      = "#15803d";
    const DARK       = "#111827";
    const MEDIUM     = "#374151";
    const MUTED      = "#6b7280";
    const RED        = "#dc2626";
    const AMBER      = "#b45309";
    const BORDER     = "#d1d5db";
    const TABLE_HEAD = "#f1f5f9";

    // ─── HEADER ────────────────────────────────────────────
    doc.rect(margin, margin, contentWidth, 3).fill(GREEN);

    const headerTop = margin + 12;
    const rightColW = 180;
    const leftColW = contentWidth - rightColW - 18;
    const rightColX = pageWidth - margin - rightColW;

    doc
      .font(pdfBoldFont)
      .fontSize(18)
      .fillColor(GREEN)
      .text(data.storeName, margin, headerTop, { width: leftColW, lineBreak: true, align: "left" });

    let leftCurY = doc.y;

    if (data.storeType) {
      doc
        .font(pdfFont)
        .fontSize(10)
        .fillColor(MEDIUM)
        .text(data.storeType, margin, leftCurY + 2, { width: leftColW });
      leftCurY = doc.y;
    }

    if (data.storePhone) {
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MUTED)
        .text(`Phone: ${data.storePhone}`, margin, leftCurY + 2, { width: leftColW });
      leftCurY = doc.y;
    }

    if (data.storeAddress) {
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MUTED)
        .text(data.storeAddress, margin, leftCurY + 1, { width: leftColW });
      leftCurY = doc.y;
    }

    if (data.storeGst) {
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MUTED)
        .text(`GSTIN: ${data.storeGst}`, margin, leftCurY + 1, { width: leftColW });
      leftCurY = doc.y;
    }

    const leftBottomY = leftCurY + 4;

    doc
      .font(pdfBoldFont)
      .fontSize(18)
      .fillColor(GREEN)
      .text("TAX INVOICE", rightColX, headerTop, { width: rightColW, align: "right" });

    doc
      .font(pdfBoldFont)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text("Invoice No:", rightColX, headerTop + 28, { width: rightColW, align: "right" });

    doc
      .font(pdfFont)
      .fontSize(10)
      .fillColor(DARK)
      .text(`#${data.invoiceNumber}`, rightColX, headerTop + 40, { width: rightColW, align: "right" });

    const rightBottomY = headerTop + 60;
    const headerEndY = Math.max(leftBottomY, rightBottomY) + 8;
    doc
      .moveTo(margin, headerEndY)
      .lineTo(pageWidth - margin, headerEndY)
      .strokeColor(BORDER)
      .lineWidth(0.75)
      .stroke();

    // ─── CUSTOMER & INVOICE INFO SECTION ──────────────────
    const infoTop   = headerEndY + 12;
    const halfW     = Math.floor((contentWidth - 16) / 2);
    const rightInfX = margin + halfW + 16;

    // LEFT – Billed To
    doc
      .font(pdfBoldFont)
      .fontSize(8)
      .fillColor(MUTED)
      .text("BILLED TO", margin, infoTop, { width: halfW });

    doc
      .font(pdfBoldFont)
      .fontSize(11)
      .fillColor(DARK)
      .text(data.customerName ?? "Walk-in Customer", margin, infoTop + 12, { width: halfW });

    let leftInfoY = doc.y;

    if (data.customerMobile) {
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MEDIUM)
        .text(data.customerMobile, margin, leftInfoY + 2, { width: halfW });
      leftInfoY = doc.y;
    }
    if (data.customerAddress) {
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MUTED)
        .text(data.customerAddress, margin, leftInfoY + 2, { width: halfW });
      leftInfoY = doc.y;
    }

    // RIGHT – Invoice Date + Payment Mode (right-aligned)
    doc
      .font(pdfBoldFont)
      .fontSize(8)
      .fillColor(MUTED)
      .text("INVOICE DATE", rightInfX, infoTop, { width: halfW, align: "right" });

    doc
      .font(pdfFont)
      .fontSize(10)
      .fillColor(DARK)
      .text(data.date, rightInfX, infoTop + 12, { width: halfW, align: "right" });

    doc
      .font(pdfBoldFont)
      .fontSize(8)
      .fillColor(MUTED)
      .text("PAYMENT MODE", rightInfX, infoTop + 32, { width: halfW, align: "right" });

    doc
      .font(pdfFont)
      .fontSize(10)
      .fillColor(DARK)
      .text(data.paymentMode, rightInfX, infoTop + 44, { width: halfW, align: "right" });

    const rightInfoBottomY = infoTop + 66;

    // ─── ITEMS TABLE ───────────────────────────────────────
    const tableTop = Math.max(leftInfoY + 12, rightInfoBottomY) + 10;

    // Column geometry
    const colAmtW   = 78;
    const colPriceW = 70;
    const colQtyW   = 38;
    const colAmt    = pageWidth - margin - colAmtW;
    const colPrice  = colAmt - colPriceW - 8;
    const colQty    = colPrice - colQtyW - 8;
    const colItemW  = colQty - margin - 6;

    // Table header background
    doc.rect(margin, tableTop, contentWidth, 20).fill(TABLE_HEAD);

    doc.font(pdfBoldFont).fontSize(8.5).fillColor(MEDIUM);
    doc.text("Item",   margin,    tableTop + 5, { width: colItemW,  align: "left"   });
    doc.text("Qty",    colQty,    tableTop + 5, { width: colQtyW,   align: "center" });
    doc.text("Price",  colPrice,  tableTop + 5, { width: colPriceW, align: "right"  });
    doc.text("Amount", colAmt,    tableTop + 5, { width: colAmtW,   align: "right"  });

    doc.moveTo(margin, tableTop).lineTo(pageWidth - margin, tableTop).strokeColor(BORDER).lineWidth(0.75).stroke();
    doc.moveTo(margin, tableTop + 20).lineTo(pageWidth - margin, tableTop + 20).strokeColor(BORDER).lineWidth(0.75).stroke();

    let rowY = tableTop + 23;

    data.items.forEach((item, i) => {
      // Page overflow guard
      if (rowY > doc.page.height - 180) {
        doc.addPage({ size: "A4", margin });
        rowY = margin + 16;
        doc.rect(margin, rowY, contentWidth, 20).fill(TABLE_HEAD);
        doc.font(pdfBoldFont).fontSize(8.5).fillColor(MEDIUM);
        doc.text("Item",   margin,   rowY + 5, { width: colItemW,  align: "left"   });
        doc.text("Qty",    colQty,   rowY + 5, { width: colQtyW,   align: "center" });
        doc.text("Price",  colPrice, rowY + 5, { width: colPriceW, align: "right"  });
        doc.text("Amount", colAmt,   rowY + 5, { width: colAmtW,   align: "right"  });
        doc.moveTo(margin, rowY).lineTo(pageWidth - margin, rowY).strokeColor(BORDER).lineWidth(0.75).stroke();
        doc.moveTo(margin, rowY + 20).lineTo(pageWidth - margin, rowY + 20).strokeColor(BORDER).lineWidth(0.75).stroke();
        rowY += 23;
      }

      // Alternate row shading
      if (i % 2 === 1) {
        doc.rect(margin, rowY - 2, contentWidth, 20).fill("#f9fafb");
      }

      doc.font(pdfFont).fontSize(9).fillColor(DARK);
      doc.text(item.name,   margin,   rowY, { width: colItemW,  align: "left"   });
      doc.text(item.qty,    colQty,   rowY, { width: colQtyW,   align: "center" });
      doc.text(item.price,  colPrice, rowY, { width: colPriceW, align: "right"  });
      doc.text(item.amount, colAmt,   rowY, { width: colAmtW,   align: "right"  });

      if (i < data.items.length - 1) {
        doc
          .moveTo(margin, rowY + 16)
          .lineTo(pageWidth - margin, rowY + 16)
          .strokeColor("#e5e7eb")
          .lineWidth(0.4)
          .stroke();
      }
      rowY += 18;
    });

    // Bottom border of table
    doc
      .moveTo(margin, rowY + 4)
      .lineTo(pageWidth - margin, rowY + 4)
      .strokeColor(BORDER)
      .lineWidth(0.75)
      .stroke();

    // ─── PRE-FLIGHT: reserve room for TOTALS + NOTES + FOOTER ───────
    //
    // Height budgets (worst case, full column heights):
    //   Totals block: 7 rows + 2 dividers + TOTAL extra bold gap ~ 140px
    //   Optional notes: wrapping text ~ 100px (3 lines, heading + text)
    //   Footer block: separator line + 1 line of centered text + gap ~ 46px
    //   Breathing room between notes+footer ~ 20px
    const TOTALS_BUDGET     = 150;
    const NOTES_BUDGET      = data.notes ? 110 : 20;
    const FOOTER_BUDGET     = 56;
    const BREATHING_ROOM    = 30;
    const RESERVED_BOTTOM   =
      TOTALS_BUDGET + NOTES_BUDGET + FOOTER_BUDGET + BREATHING_ROOM + margin;

    if (rowY + 18 > doc.page.height - RESERVED_BOTTOM) {
      doc.addPage({ size: "A4", margin });
      rowY = margin + 10;
    }

    // ─── TOTALS ────────────────────────────────────────────
    const totalsBoxW = 224;
    const totalsX    = pageWidth - margin - totalsBoxW;
    const labelW     = 136;
    const valW       = 80;
    let   ty         = rowY + 18;

    const drawTotalsRow = (
      label: string,
      value: string,
      color: string,
      bold = false,
      size = 9.5,
    ) => {
      doc
        .font(bold ? pdfBoldFont : pdfFont)
        .fontSize(size)
        .fillColor(color)
        .text(label, totalsX, ty, { width: labelW, align: "right" });
      doc
        .font(bold ? pdfBoldFont : pdfFont)
        .fontSize(size)
        .fillColor(color)
        .text(value, totalsX + labelW, ty, { width: valW, align: "right" });
      ty += size + 8;
    };

    drawTotalsRow("Subtotal",  formatCurrencyValue(data.subtotal), MEDIUM);
    drawTotalsRow("Discount",  formatCurrencyValue(data.discount), MEDIUM);
    drawTotalsRow("Tax (GST)", formatCurrencyValue(data.tax),      MEDIUM);

    // Divider before TOTAL
    doc
      .moveTo(totalsX, ty - 2)
      .lineTo(pageWidth - margin, ty - 2)
      .strokeColor(BORDER)
      .lineWidth(0.75)
      .stroke();
    ty += 4;

    drawTotalsRow("TOTAL", formatCurrencyValue(data.total), DARK, true, 13);

    doc
      .moveTo(totalsX, ty)
      .lineTo(pageWidth - margin, ty)
      .strokeColor("#e5e7eb")
      .lineWidth(0.4)
      .stroke();
    ty += 6;

    drawTotalsRow("Paid", formatCurrencyValue(data.paid), GREEN);

    if (Number(data.due) > 0) {
      drawTotalsRow("Due", formatCurrencyValue(data.due), RED, true);
      if (data.dueDate) {
        drawTotalsRow("Expected By", data.dueDate, AMBER);
      }
    }

    // ─── NOTES (normal flow, always on LAST REAL content page) ────
    // Ensure notes + footer budget still fit on the *current* page after
    // the totals block finishes drawing at ty.
    const notesFooterGuard = ty + NOTES_BUDGET + FOOTER_BUDGET + 20;
    if (notesFooterGuard > doc.page.height - margin - 10) {
      doc.addPage({ size: "A4", margin });
      ty = margin + 10;
    }

    if (data.notes) {
      const notesY = ty + 14;
      doc
        .font(pdfBoldFont)
        .fontSize(8)
        .fillColor(MUTED)
        .text("Notes:", margin, notesY);
      doc
        .font(pdfFont)
        .fontSize(9)
        .fillColor(MEDIUM)
        .text(data.notes, margin, doc.y + 2, { width: contentWidth });
    }

    // ─── FOOTER ────────────────────────────────────────────
    // Draw the footer on the CURRENT (last) page only, in the SAME content
    // stream as the last totals / notes block.  We MUST NEVER allow PDFKit
    // to silently auto-add a page between footer-rect and footer-text, so:
    //   1) Reserve a small 40pt "footer slot" near the bottom of the page
    //      *inside* the margin-safe zone (bottom margin = 40pts).
    //   2) Before any footer drawing, save the page margins, set the
    //      bottom margin to 0 temporarily so absolute drawing cannot
    //      trigger auto-addPage().
    //   3) Draw the separator line + text together.
    //   4) Restore margin settings for any future documents that reuse doc.
    //   5) If doc.y (end of totals / notes) has already grown past the
    //      start of the footer slot, add ONE page first and draw footer on
    //      the new page — but only after we know the previous page has
    //      genuine totals / notes content on it already, never a blank
    //      page with only a footer.

    const footerBoxTop = doc.page.height - margin - FOOTER_BUDGET + 10; // 795 area → 765 area inside margin
    const footerSepY   = footerBoxTop;
    const footerTextY  = footerSepY + 10; // ~ 775, well above margin cutoff at 801.89

    // If the last flowing content (doc.y) ends past the top of the footer
    // slot, we cannot squeeze the footer onto this page without overlap,
    // so we promote it to a new page first. This only happens for very
    // long notes blocks — which means the previous page already contains
    // real content (header + items + totals + most of notes), so the new
    // page is not "footer-only".
    if (doc.y > footerSepY - 4) {
      doc.addPage({ size: "A4", margin });
    }

    // Snapshot the current margins, disable the bottom margin for footer
    // drawing so doc.text() can never auto-add page 2.
    const savedBottom = (doc.page.margins as { bottom: number }).bottom;
    try {
      (doc.page.margins as { bottom: number }).bottom = 0;

      // Separator line — rectangle primitive, never triggers page break
      doc
        .rect(margin, footerSepY, contentWidth, 0.5)
        .fill(BORDER);

      // Single centered footer line, drawn with explicit y-coordinate.
      doc
        .font(pdfFont)
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          "Thank you for your business!  \u00B7  Generated by MiDukandar",
          margin,
          footerTextY,
          { width: contentWidth, align: "center", height: 12, lineBreak: false },
        );
    } finally {
      (doc.page.margins as { bottom: number }).bottom = savedBottom;
    }

    doc.end();
  });
}

export interface ProductReportRow {
  name: string;
  category: string;
  sku: string;
  barcode: string;
  purchasePrice: string;
  sellingPrice: string;
  gstPercent: string;
  stock: string;
  status: string;
}

export interface ProductReportData {
  storeName: string;
  generatedAt: string;
  total: number;
  active: number;
  low: number;
  out: number;
  title: string;
  subtitle?: string;
  rows: ProductReportRow[];
}

const HEADER_BG = "2E4057";
const ACCENT = "1E40AF";

/**
 * Generates a professional multi-page product report.
 * Table header repeats on every page and rows are never split mid-row.
 */
export function generateProductPdf(data: ProductReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const margin = 40;
    const contentWidth = doc.page.width - margin * 2;
    const bottom = doc.page.height - 56;

    const cols = {
      sr: margin,
      name: margin + 26,
      category: margin + 240,
      sku: margin + 340,
      barcode: margin + 410,
      pp: margin + 500,
      sp: margin + 565,
      gst: margin + 630,
      stock: margin + 680,
      status: margin + 730,
    };

    const drawHeader = (y: number) => {
      doc
        .fillColor("#ffffff")
        .rect(margin, y, contentWidth, 22)
        .fill(HEADER_BG);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
      doc.text("Sr. No.", cols.sr, y + 7, { width: 24 });
      doc.text("Product Name", cols.name, y + 7, { width: 210 });
      doc.text("Category", cols.category, y + 7, { width: 96 });
      doc.text("SKU", cols.sku, y + 7, { width: 66 });
      doc.text("Barcode", cols.barcode, y + 7, { width: 86 });
      doc.text("Purchase", cols.pp, y + 7, { width: 62, align: "right" });
      doc.text("Selling", cols.sp, y + 7, { width: 62, align: "right" });
      doc.text("GST%", cols.gst, y + 7, { width: 46, align: "right" });
      doc.text("Stock", cols.stock, y + 7, { width: 46, align: "right" });
      doc.text("Status", cols.status, y + 7, { width: 48, align: "right" });
    };

    const titleY = margin;
    doc
      .fillColor("#2E4057")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("MiDukandar", margin, titleY);
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text("Smart Business Management", margin, titleY + 24);

    doc
      .fontSize(15)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text(data.title, pageWidth - margin - 220, titleY, { width: 220, align: "right" });
    if (data.subtitle) {
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text(data.subtitle, pageWidth - margin - 220, titleY + 22, { width: 220, align: "right" });
    }

    // Meta / totals strip
    const metaY = titleY + 52;
    doc
      .fillColor("#f3f4f6")
      .rect(margin, metaY, contentWidth, 40)
      .fill();
    doc.fillColor("#374151").fontSize(9).font("Helvetica");
    doc.text(`Store: ${data.storeName}`, margin + 10, metaY + 8, { width: contentWidth / 2 });
    doc.text(`Generated: ${data.generatedAt}`, margin + 10, metaY + 20, { width: contentWidth / 2 });
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text(`Total: ${data.total}   Active: ${data.active}   Low Stock: ${data.low}   Out: ${data.out}`, margin + contentWidth / 2 - 60, metaY + 12, { width: contentWidth / 2 + 50, align: "right" });

    let y = metaY + 52;
    drawHeader(y);
    y += 26;

    data.rows.forEach((row, i) => {
      if (y > bottom - 14) {
        doc.addPage({ size: "A4", layout: "landscape", margin });
        y = margin;
        drawHeader(y);
        y += 26;
      }
      if (i % 2 === 0) {
        doc
          .fillColor("#f9fafb")
          .rect(margin, y - 3, contentWidth, 18)
          .fill();
      }
      doc.font("Helvetica").fontSize(8).fillColor("#111827");
      doc.text(String(i + 1), cols.sr, y, { width: 24 });
      doc.text(row.name, cols.name, y, { width: 208 });
      doc.text(row.category || "-", cols.category, y, { width: 96 });
      doc.text(row.sku || "-", cols.sku, y, { width: 66 });
      doc.text(row.barcode || "-", cols.barcode, y, { width: 86 });
      doc.text(`${RUPEE}${row.purchasePrice}`, cols.pp, y, { width: 62, align: "right" });
      doc.text(`${RUPEE}${row.sellingPrice}`, cols.sp, y, { width: 62, align: "right" });
      doc.text(row.gstPercent, cols.gst, y, { width: 46, align: "right" });
      doc.text(row.stock, cols.stock, y, { width: 46, align: "right" });

      const statusColor = row.status === "Out of Stock" ? "#dc2626" : row.status === "Low Stock" ? "#d97706" : "#15803d";
      doc.fillColor(statusColor).text(row.status, cols.status, y, { width: 48, align: "right" });
      y += 18;
    });

    // underline table bottom
    doc
      .moveTo(margin, y + 4)
      .lineTo(pageWidth - margin, y + 4)
      .strokeColor("#d1d5db")
      .lineWidth(0.75)
      .stroke();

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#9ca3af")
      .text("Generated by MiDukandar", margin, doc.page.height - 32, { width: contentWidth, align: "left" });
    doc.text("\u00A9 2026 Codeshub", pageWidth - margin - 120, doc.page.height - 32, { width: 120, align: "right" });

    void ACCENT; // suppress unused var warning

    doc.end();
  });
}