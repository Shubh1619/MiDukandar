"use client";

import { formatINR } from "@/lib/format";
import type { InvoiceData } from "@/lib/types";

interface InvoicePreviewProps {
  data: InvoiceData;
  variant?: "print" | "modal";
}

function fmtDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

const GREEN = "#15803d";
const DARK = "#111827";
const MEDIUM = "#374151";
const MUTED = "#6b7280";
const RED = "#dc2626";
const AMBER = "#b45309";
const BORDER = "#d1d5db";
const TABLE_HEAD = "#f1f5f9";

export function InvoicePreview({
  data,
  variant = "print",
}: InvoicePreviewProps) {
  const isModal = variant === "modal";

  const wrapperStyle: React.CSSProperties = isModal
    ? {
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: "13px",
        lineHeight: 1.45,
        color: DARK,
        background: "#ffffff",
        width: "100%",
        maxWidth: "none",
        margin: "0 auto",
        padding: "6px 18px 28px",
        boxSizing: "border-box",
        minHeight: 0,
        maxHeight: "none",
        overflow: "visible",
        borderRadius: "6px",
      }
    : {
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: "13px",
        lineHeight: 1.4,
        color: DARK,
        background: "#ffffff",
        width: "210mm",
        maxWidth: "none",
        minHeight: "297mm",
        margin: "0",
        padding: "12mm 14mm",
        boxSizing: "border-box",
        overflow: "visible",
        position: "relative",
      };

  return (
    <div
      id="invoice-print-area"
      className={
        isModal ? "invoice-modal invoice-printable" : "invoice-print invoice-printable"
      }
      style={wrapperStyle}
    >
      {/* TOP GREEN LINE (print/pdf only; modal shows its own card style) */}
      {!isModal && (
        <div
          aria-hidden
          style={{
            height: "3px",
            background: GREEN,
            marginBottom: "5mm",
          }}
        />
      )}

      {/* HEADER */}
      <header
        style={{
          display: "flex",
          flexDirection: isModal ? "row" : "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: isModal ? "16px 28px" : "6mm 8mm",
          marginBottom: isModal ? "18px" : "6mm",
          width: "100%",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        {/* STORE DETAILS */}
        <div
          style={{
            flex: "1 1 340px",
            minWidth: 0,
            maxWidth: isModal ? "58%" : "56%",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: isModal ? "clamp(18px, 1.8vw, 26px)" : "22px",
              fontWeight: 800,
              color: GREEN,
              lineHeight: 1.15,
              margin: "0 0 4px 0",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
            title={data.store?.name ?? "MiDukandar"}
          >
            {data.store?.name ?? "MiDukandar"}
          </p>

          {data.store?.type && (
            <p
              style={{
                fontSize: isModal ? "12px" : "11px",
                color: MEDIUM,
                margin: "0 0 4px 0",
                fontWeight: 600,
              }}
            >
              {data.store.type}
            </p>
          )}

          {data.store?.phone && (
            <p
              style={{
                fontSize: isModal ? "11px" : "10.5px",
                color: MUTED,
                margin: "0 0 2px 0",
              }}
            >
              Phone: {data.store.phone}
            </p>
          )}

          {data.store?.address && (
            <p
              style={{
                fontSize: isModal ? "11px" : "10.5px",
                color: MUTED,
                margin: "0 0 2px 0",
                lineHeight: 1.4,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
            >
              {data.store.address}
            </p>
          )}

          {data.store?.gst && (
            <p
              style={{
                fontSize: isModal ? "11px" : "10.5px",
                color: MUTED,
                margin: "0",
              }}
            >
              GSTIN: {data.store.gst}
            </p>
          )}
        </div>

        {/* INVOICE DETAILS (right) */}
        <div
          style={{
            flex: "0 1 auto",
            minWidth: isModal ? "230px" : "190px",
            maxWidth: isModal ? "40%" : "40%",
            textAlign: "right",
            width: "auto",
          }}
        >
          <p
            style={{
              fontSize: isModal ? "clamp(17px, 1.7vw, 23px)" : "20px",
              fontWeight: 800,
              color: GREEN,
              margin: "0 0 8px 0",
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            TAX INVOICE
          </p>

          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "2px",
              minWidth: "180px",
            }}
          >
            <p
              style={{
                fontSize: isModal ? "12px" : "11px",
                color: MUTED,
                margin: "0",
                whiteSpace: "nowrap",
              }}
            >
              Invoice No:{" "}
              <span
                style={{
                  color: DARK,
                  fontWeight: 700,
                }}
              >
                #{data.invoiceNumber}
              </span>
            </p>

            <p
              style={{
                fontSize: isModal ? "12px" : "11px",
                color: MUTED,
                margin: "0",
                whiteSpace: "nowrap",
              }}
            >
              Date: {fmtDate(data.date)}
            </p>
          </div>
        </div>
      </header>

      {/* DIVIDER */}
      <hr
        style={{
          border: "none",
          borderTop: "0.75px solid " + BORDER,
          margin: `0 0 ${isModal ? "18px" : "5mm"} 0`,
        }}
      />

      {/* CUSTOMER + INVOICE META */}
      <section
        style={{
          display: "flex",
          flexDirection: isModal ? "row" : "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: isModal ? "16px 28px" : "5mm 8mm",
          marginBottom: isModal ? "18px" : "5mm",
          width: "100%",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        {/* CUSTOMER (left) */}
        <div
          style={{
            flex: "1 1 320px",
            minWidth: 0,
            maxWidth: isModal ? "56%" : "54%",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: isModal ? "10.5px" : "9.5px",
              fontWeight: 700,
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 6px 0",
            }}
          >
            Billed To
          </p>

          <p
            style={{
              fontSize: isModal ? "14px" : "13px",
              fontWeight: 700,
              color: DARK,
              margin: "0 0 2px 0",
              overflowWrap: "anywhere",
            }}
          >
            {data.customer?.name ?? "Walk-in Customer"}
          </p>

          {data.customer?.mobile && (
            <p
              style={{
                fontSize: isModal ? "12px" : "11px",
                color: MEDIUM,
                margin: "0 0 2px 0",
              }}
            >
              {data.customer.mobile}
            </p>
          )}

          {data.customer?.address && (
            <p
              style={{
                fontSize: isModal ? "11.5px" : "10.5px",
                color: MUTED,
                margin: "0",
                overflowWrap: "anywhere",
                lineHeight: 1.4,
              }}
            >
              {data.customer.address}
            </p>
          )}
        </div>

        {/* INVOICE META (right) */}
        <div
          style={{
            flex: "0 1 auto",
            minWidth: isModal ? "220px" : "180px",
            maxWidth: isModal ? "40%" : "42%",
            textAlign: "right",
            width: "auto",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "10px",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: isModal ? "10.5px" : "9.5px",
                  fontWeight: 700,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 3px 0",
                }}
              >
                Invoice Date
              </p>
              <p
                style={{
                  fontSize: isModal ? "12.5px" : "11.5px",
                  color: DARK,
                  margin: "0",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtDate(data.date)}
              </p>
            </div>

            <div>
              <p
                style={{
                  fontSize: isModal ? "10.5px" : "9.5px",
                  fontWeight: 700,
                  color: MUTED,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 3px 0",
                }}
              >
                Payment Mode
              </p>
              <p
                style={{
                  fontSize: isModal ? "12.5px" : "11.5px",
                  color: DARK,
                  margin: "0",
                  whiteSpace: "nowrap",
                }}
              >
                {data.paymentMode}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ITEMS TABLE */}
      <section
        aria-label="Invoice items"
        style={{
          width: "100%",
          overflowX: "hidden",
          marginBottom: "0",
        }}
      >
        <table
          role="table"
          style={{
            width: "100%",
            minWidth: 0,
            borderCollapse: "collapse",
            borderSpacing: 0,
            marginBottom: "0",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr
              style={{
                background: TABLE_HEAD,
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
              <th
                scope="col"
                style={{
                  padding: isModal ? "9px 10px" : "2.2mm 3mm",
                  textAlign: "left",
                  fontSize: isModal ? "11px" : "10px",
                  fontWeight: 700,
                  color: MEDIUM,
                  borderTop: "0.75px solid " + BORDER,
                  borderBottom: "0.75px solid " + BORDER,
                  letterSpacing: "0.02em",
                }}
              >
                Item
              </th>

              <th
                scope="col"
                style={{
                  padding: isModal ? "9px 10px" : "2.2mm 3mm",
                  textAlign: "center",
                  fontSize: isModal ? "11px" : "10px",
                  fontWeight: 700,
                  color: MEDIUM,
                  borderTop: "0.75px solid " + BORDER,
                  borderBottom: "0.75px solid " + BORDER,
                  width: isModal ? "80px" : "18mm",
                  letterSpacing: "0.02em",
                }}
              >
                Qty
              </th>

              <th
                scope="col"
                style={{
                  padding: isModal ? "9px 10px" : "2.2mm 3mm",
                  textAlign: "right",
                  fontSize: isModal ? "11px" : "10px",
                  fontWeight: 700,
                  color: MEDIUM,
                  borderTop: "0.75px solid " + BORDER,
                  borderBottom: "0.75px solid " + BORDER,
                  width: isModal ? "120px" : "26mm",
                  letterSpacing: "0.02em",
                }}
              >
                Price
              </th>

              <th
                scope="col"
                style={{
                  padding: isModal ? "9px 10px" : "2.2mm 3mm",
                  textAlign: "right",
                  fontSize: isModal ? "11px" : "10px",
                  fontWeight: 700,
                  color: MEDIUM,
                  borderTop: "0.75px solid " + BORDER,
                  borderBottom: "0.75px solid " + BORDER,
                  width: isModal ? "130px" : "28mm",
                  letterSpacing: "0.02em",
                }}
              >
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {data.items.map((item, i) => (
              <tr
                key={i}
                className="invoice-item-row"
                style={{
                  background: i % 2 === 1 ? "#f9fafb" : "#ffffff",
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                }}
              >
                <td
                  style={{
                    padding: isModal ? "9px 10px" : "2.2mm 3mm",
                    fontSize: isModal ? "12.5px" : "11.5px",
                    color: DARK,
                    borderBottom:
                      i < data.items.length - 1
                        ? "0.4px solid #e5e7eb"
                        : "none",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {item.name}
                </td>

                <td
                  style={{
                    padding: isModal ? "9px 10px" : "2.2mm 3mm",
                    textAlign: "center",
                    fontSize: isModal ? "12.5px" : "11.5px",
                    color: DARK,
                    borderBottom:
                      i < data.items.length - 1
                        ? "0.4px solid #e5e7eb"
                        : "none",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.qty}
                </td>

                <td
                  style={{
                    padding: isModal ? "9px 10px" : "2.2mm 3mm",
                    textAlign: "right",
                    fontSize: isModal ? "12.5px" : "11.5px",
                    color: DARK,
                    borderBottom:
                      i < data.items.length - 1
                        ? "0.4px solid #e5e7eb"
                        : "none",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatINR(item.price)}
                </td>

                <td
                  style={{
                    padding: isModal ? "9px 10px" : "2.2mm 3mm",
                    textAlign: "right",
                    fontSize: isModal ? "12.5px" : "11.5px",
                    color: DARK,
                    borderBottom:
                      i < data.items.length - 1
                        ? "0.4px solid #e5e7eb"
                        : "none",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatINR(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* TABLE BOTTOM BORDER */}
      <hr
        style={{
          border: "none",
          borderTop: "0.75px solid " + BORDER,
          margin: `${isModal ? "18px" : "5mm"} 0 ${isModal ? "18px" : "4mm"} 0`,
        }}
      />

      {/* TOTALS (right-aligned) */}
      <section
        className="invoice-totals"
        aria-label="Invoice totals"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: isModal ? "14px" : "4mm",
          breakInside: "avoid",
          pageBreakInside: "avoid",
          breakBefore: "auto",
          pageBreakBefore: "auto",
        }}
      >
        <table
          role="table"
          style={{
            minWidth: isModal ? "260px" : "70mm",
            width: isModal ? "320px" : "78mm",
            maxWidth: "100%",
            borderCollapse: "collapse",
            borderSpacing: 0,
          }}
        >
          <tbody>
            <TotalsRow
              label="Subtotal"
              value={formatINR(data.subtotal)}
              color={MEDIUM}
              isModal={isModal}
            />

            <TotalsRow
              label="Discount"
              value={formatINR(data.discount)}
              color={MEDIUM}
              isModal={isModal}
            />

            <TotalsRow
              label="Tax (GST)"
              value={formatINR(data.tax)}
              color={MEDIUM}
              isModal={isModal}
            />

            {/* Divider before TOTAL */}
            <tr aria-hidden>
              <td
                colSpan={2}
                style={{ padding: "3px 0 0 0" }}
              >
                <div
                  style={{
                    borderTop: "0.75px solid " + BORDER,
                    width: "100%",
                  }}
                />
              </td>
            </tr>

            {/* TOTAL */}
            <tr style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              <td
                style={{
                  padding: isModal ? "8px 14px 8px 0" : "2.2mm 4mm 2.2mm 0",
                  fontSize: isModal ? "15px" : "13px",
                  fontWeight: 800,
                  color: DARK,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                TOTAL
              </td>

              <td
                style={{
                  padding: isModal ? "8px 0" : "2.2mm 0",
                  fontSize: isModal ? "15px" : "13px",
                  fontWeight: 800,
                  color: DARK,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {formatINR(data.total)}
              </td>
            </tr>

            {/* Divider after TOTAL */}
            <tr aria-hidden>
              <td
                colSpan={2}
                style={{ padding: "1px 0 3px 0" }}
              >
                <div
                  style={{
                    borderTop: "0.4px solid #e5e7eb",
                    width: "100%",
                  }}
                />
              </td>
            </tr>

            <TotalsRow
              label="Paid"
              value={formatINR(data.paid)}
              color={GREEN}
              isModal={isModal}
            />

            {data.due > 0 && (
              <>
                <TotalsRow
                  label="Due"
                  value={formatINR(data.due)}
                  color={RED}
                  bold
                  isModal={isModal}
                />

                {data.dueDate && (
                  <TotalsRow
                    label="Expected By"
                    value={data.dueDate}
                    color={AMBER}
                    isModal={isModal}
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </section>

      {/* NOTES */}
      {data.notes && (
        <section
          aria-label="Invoice notes"
          style={{
            borderTop: "0.75px solid #e5e7eb",
            paddingTop: isModal ? "12px" : "3mm",
            marginBottom: isModal ? "12px" : "3.5mm",
            breakInside: "avoid",
            pageBreakInside: "avoid",
          }}
        >
          <p
            style={{
              fontSize: isModal ? "11px" : "10.5px",
              fontWeight: 700,
              color: MUTED,
              margin: "0 0 4px 0",
            }}
          >
            Notes:
          </p>

          <p
            style={{
              fontSize: isModal ? "12px" : "11.5px",
              color: MEDIUM,
              margin: "0",
              overflowWrap: "anywhere",
              lineHeight: 1.45,
            }}
          >
            {data.notes}
          </p>
        </section>
      )}

      {/* FOOTER - OUTSIDE all tables, in normal flow */}
      <footer
        className="invoice-footer"
        style={{
          borderTop: "0.5px solid " + BORDER,
          paddingTop: isModal ? "12px" : "3mm",
          marginTop: isModal ? "6px" : "1mm",
          textAlign: "center",
          breakInside: "avoid",
          pageBreakInside: "avoid",
          breakBefore: "avoid",
          pageBreakBefore: "avoid",
          // ensure footer never orphans alone: if pushed near bottom, allow on next page ONLY with content above
          orphans: 3,
          widows: 3,
        }}
      >
        <p
          style={{
            fontSize: isModal ? "11px" : "10px",
            color: "#9ca3af",
            margin: "0",
            lineHeight: 1.5,
          }}
        >
          Thank you for your business! &nbsp;·&nbsp; Generated by MiDukandar
        </p>
        <p
          style={{
            fontSize: isModal ? "10px" : "9px",
            color: "#9ca3af",
            margin: "2px 0 0 0",
            lineHeight: 1.4,
            opacity: 0.9,
          }}
        >
          MiDukandar - Smart Business Management
        </p>
      </footer>

      {/* ==========================================================
           SHARED RESET + PRINT STYLES (both modal uses same styles
           for internal list resets, print variant adds A4 rules)
           ========================================================== */}
      <style>{`
        /* ── Defensive list resets inside invoice (root cause of tiny "1"s) ── */
        #invoice-print-area ol,
        #invoice-print-area ul,
        .invoice-modal ol,
        .invoice-modal ul,
        .invoice-print ol,
        .invoice-print ul {
          list-style: none !important;
          margin: 0 !important;
          padding: 0 !important;
          counter-reset: none !important;
        }

        #invoice-print-area li,
        .invoice-modal li,
        .invoice-print li {
          list-style: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        #invoice-print-area li::marker,
        .invoice-modal li::marker,
        .invoice-print li::marker {
          content: none !important;
          display: none !important;
        }

        #invoice-print-area li::before,
        .invoice-modal li::before,
        .invoice-print li::before {
          content: none !important;
          display: none !important;
        }

        /* kill any accidental CSS counters on table elements */
        #invoice-print-area table,
        #invoice-print-area thead,
        #invoice-print-area tbody,
        #invoice-print-area tr,
        #invoice-print-area th,
        #invoice-print-area td,
        .invoice-modal table,
        .invoice-modal thead,
        .invoice-modal tbody,
        .invoice-modal tr,
        .invoice-modal th,
        .invoice-modal td,
        .invoice-print table,
        .invoice-print thead,
        .invoice-print tbody,
        .invoice-print tr,
        .invoice-print th,
        .invoice-print td {
          counter-reset: none !important;
          counter-increment: none !important;
          list-style: none !important;
        }

        #invoice-print-area tr::before,
        #invoice-print-area td::before,
        #invoice-print-area th::before,
        .invoice-modal tr::before,
        .invoice-modal td::before,
        .invoice-modal th::before,
        .invoice-print tr::before,
        .invoice-print td::before,
        .invoice-print th::before {
          content: none !important;
          display: none !important;
        }

        /* ── Prevent rows / sections from splitting across pages ── */
        #invoice-print-area tr,
        .invoice-print tr,
        .invoice-item-row {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        #invoice-print-area thead,
        .invoice-print thead {
          display: table-header-group !important;
        }

        #invoice-print-area tfoot,
        .invoice-print tfoot {
          display: table-footer-group !important;
        }

        #invoice-print-area .invoice-totals,
        .invoice-print .invoice-totals,
        #invoice-print-area .invoice-footer,
        .invoice-print .invoice-footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        #invoice-print-area section,
        .invoice-print section,
        #invoice-print-area header,
        .invoice-print header {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* No forced page breaks */
        #invoice-print-area *,
        .invoice-print * {
          break-before: auto !important;
          page-break-before: auto !important;
          break-after: auto !important;
          page-break-after: auto !important;
        }

        /* ── A4 PRINT RULES ───────────────────────────────────── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          @page :first {
            margin-top: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 210mm !important;
            overflow: visible !important;
          }

          /*
            Print isolation: hide EVERYTHING in the document (including
            Radix Dialog portals, overlays, toasts, shell chrome, sidebar,
            shadcn DialogContent/DialogFooter/etc) EXCEPT the printable
            invoice node and its descendants.  This works regardless of
            whether the invoice is rendered inside a dialog portal OR in
            the body's normal layout flow.
          */
          body,
          body * {
            visibility: hidden !important;
          }

          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible !important;
          }

          /* Force the invoice wrapper out of portal / dialog positioning
             context, place it at page origin, exact A4 physical dims,
             box-sizing so the 12/14mm padding stays inside 210mm. */
          #invoice-print-area {
            all: unset !important;
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            max-height: none !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 12mm 14mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: none !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            text-rendering: geometricPrecision !important;
            transform: none !important;
            filter: none !important;
            opacity: 1 !important;
            z-index: 2147483647 !important;
          }

          /* During print, convert the "modal" variant visually to match
             the "print" variant exactly: show the green top line, use
             the print typography scale, drop any modal card chrome.
             This replaces the previous .invoice-modal { display: none }
             bug that made print-from-dialog blank. */
          #invoice-print-area.invoice-modal::before {
            content: "" !important;
            display: block !important;
            height: 3px !important;
            background: #15803d !important;
            margin-bottom: 5mm !important;
            margin-top: 0 !important;
          }

          #invoice-print-area hr {
            border-color: #d1d5db !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   TOTALS ROW (shared helper - semantic tr/td, no list markup)
   ========================================================= */

function TotalsRow({
  label,
  value,
  color = "#374151",
  bold = false,
  isModal = false,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
  isModal?: boolean;
}) {
  return (
    <tr style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
      <td
        style={{
          padding: isModal ? "4.5px 14px 4.5px 0" : "1.2mm 4mm 1.2mm 0",
          fontSize: isModal ? "12.5px" : "11.5px",
          fontWeight: bold ? 700 : 400,
          color,
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </td>

      <td
        style={{
          padding: isModal ? "4.5px 0" : "1.2mm 0",
          fontSize: isModal ? "12.5px" : "11.5px",
          fontWeight: bold ? 700 : 400,
          color,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
