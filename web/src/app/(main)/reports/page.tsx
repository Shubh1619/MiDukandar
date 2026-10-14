"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ReceiptText,
  ShoppingCart,
  Package,
  FileBarChart2,
  BarChart3,
  Search,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import type {
  ReportsRow,
  ReportsTotals,
  StockRow,
  GstReportResponse,
  GstRateBreakup,
  Gstr1InvoiceRow,
  PnlReportResponse,
  PnlTrendRow,
  StockMovementReportRow,
  StockMovementReportResponse,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyTableRow } from "@/components/shared/empty-state";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pct(val: number, total: number) {
  if (total === 0) return "—";
  return `${((val / total) * 100).toFixed(1)}%`;
}

function getPreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOf = (unit: "week" | "month" | "quarter" | "year"): Date => {
    const d = new Date(now);
    if (unit === "week") {
      d.setDate(d.getDate() - d.getDay());
    } else if (unit === "month") {
      d.setDate(1);
    } else if (unit === "quarter") {
      const q = Math.floor(d.getMonth() / 3);
      d.setMonth(q * 3, 1);
    } else {
      d.setMonth(0, 1);
    }
    return d;
  };

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "week":
      return { from: fmt(startOf("week")), to: fmt(now) };
    case "month":
      return { from: fmt(startOf("month")), to: fmt(now) };
    case "lastMonth": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(lm), to: fmt(lme) };
    }
    case "quarter":
      return { from: fmt(startOf("quarter")), to: fmt(now) };
    case "year":
      return { from: fmt(startOf("year")), to: fmt(now) };
    default:
      return { from: fmt(now), to: fmt(now) };
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <p className="text-xl font-display font-bold tabular-nums">{value}</p>
      {sub && (
        <p
          className={`text-xs font-medium ${
            positive === true
              ? "text-emerald-600 dark:text-emerald-400"
              : positive === false
                ? "text-red-500"
                : "text-muted-foreground"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface SalesRep {
  rows: ReportsRow[];
  totals: ReportsTotals;
}

interface PurchaseRep {
  rows: ReportsRow[];
  totals: ReportsTotals;
}

export default function ReportsPage() {
  const { t } = useI18n();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [activeTab, setActiveTab] = useState("sales");

  // Data state
  const [sales, setSales] = useState<SalesRep | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRep | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockValue, setStockValue] = useState(0);
  const [stockSearch, setStockSearch] = useState("");
  const [stockMovements, setStockMovements] = useState<StockMovementReportResponse | null>(null);
  const [stockMovSearch, setStockMovSearch] = useState("");
  const [gst, setGst] = useState<GstReportResponse | null>(null);
  const [pnl, setPnl] = useState<PnlReportResponse | null>(null);

  // Expand state for sales drill-down
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [loadedRange, setLoadedRange] = useState({ from: "", to: "" });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setExpandedDates(new Set());
    try {
      const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [sData, pData, stData, smData, gstData, pnlData] = await Promise.all([
        apiFetch<SalesRep>(`/api/reports/sales?${qs}`),
        apiFetch<PurchaseRep>(`/api/reports/purchases?${qs}`),
        apiFetch<{ stock: StockRow[]; totalValue: number }>("/api/reports/stock/current"),
        apiFetch<StockMovementReportResponse>(`/api/reports/stock/movements?${qs}`),
        apiFetch<GstReportResponse>(`/api/reports/gst?${qs}`),
        apiFetch<PnlReportResponse>(`/api/reports/pnl?${qs}`),
      ]);
      setSales(sData);
      setPurchases(pData);
      setStock(stData.stock);
      setStockValue(stData.totalValue);
      setStockMovements(smData);
      setGst(gstData);
      setPnl(pnlData);
      setLoadedRange({ from, to });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const applyPreset = (preset: string) => {
    const range = getPreset(preset);
    setFrom(range.from);
    setTo(range.to);
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Filtered stock (client-side for current stock tab)
  const filteredStock = stockSearch
    ? stock.filter((r) => r.name.toLowerCase().includes(stockSearch.toLowerCase()))
    : stock;

  // Filtered stock movements
  const filteredMov = stockMovSearch
    ? (stockMovements?.rows ?? []).filter((r) =>
        r.productName.toLowerCase().includes(stockMovSearch.toLowerCase()),
      )
    : (stockMovements?.rows ?? []);

  const PRESETS = [
    { key: "today", label: t("presetToday") },
    { key: "week", label: t("presetWeek") },
    { key: "month", label: t("presetMonth") },
    { key: "lastMonth", label: t("presetLastMonth") },
    { key: "quarter", label: t("presetQuarter") },
    { key: "year", label: t("presetYear") },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold">{t("navReports")}</h1>
        <p className="text-xs text-muted-foreground">
          Sales · Purchases · Stock · GST · P&amp;L
        </p>
      </div>

      {/* Date Filter Bar */}
      <div className="rounded-xl border bg-card p-3 space-y-3">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Date inputs + Apply */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("from")}</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("to")}</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
          <Button onClick={() => void loadAll()} disabled={loading} size="sm">
            {loading && <Loader2 className="size-3.5 animate-spin mr-1" />}
            {t("apply")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="sales" className="gap-1.5">
            <ReceiptText className="size-3.5" />{t("salesReport")}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5">
            <ShoppingCart className="size-3.5" />{t("purchaseReport")}
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="size-3.5" />{t("stockReport")}
          </TabsTrigger>
          <TabsTrigger value="gst" className="gap-1.5">
            <FileBarChart2 className="size-3.5" />{t("gstSummary")}
          </TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1.5">
            <BarChart3 className="size-3.5" />{t("pnlSummary")}
          </TabsTrigger>
        </TabsList>

        {/* ──────── SALES TAB ──────── */}
        <TabsContent value="sales" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {sales
                ? `${sales.totals.invoices ?? 0} invoices · ${loadedRange.from} → ${loadedRange.to}`
                : " "}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!sales}
              onClick={() =>
                sales &&
                downloadCsv(
                  `sales-report-${from}-${to}.csv`,
                  ["Date", "Invoices", "Subtotal", "Discount", "Tax", "Total"],
                  sales.rows.map((r) => [
                    r.date,
                    r.invoiceCount ?? 0,
                    r.subtotal,
                    r.discount,
                    r.tax,
                    r.total,
                  ]),
                )
              }
            >
              <Download className="size-3.5 mr-1" /> {t("exportCsv")}
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            {loading && !sales ? (
              <TableSkeleton rows={6} className="h-9" />
            ) : sales ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">{t("subtotal")}</TableHead>
                    <TableHead className="text-right">{t("discount")}</TableHead>
                    <TableHead className="text-right">{t("tax")}</TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.rows.length === 0 && (
                    <EmptyTableRow colSpan={7} message={t("noData")} />
                  )}
                  {sales.rows.map((r) => {
                    const expanded = expandedDates.has(r.date);
                    return (
                      <>
                        <TableRow
                          key={r.date}
                          className="cursor-pointer hover:bg-accent/30"
                          onClick={() => toggleDate(r.date)}
                        >
                          <TableCell className="text-muted-foreground">
                            {r.invoices && r.invoices.length > 0 ? (
                              expanded ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{r.date}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.invoiceCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.subtotal)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.discount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.tax)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatINR(r.total)}
                          </TableCell>
                        </TableRow>
                        {expanded && r.invoices && r.invoices.map((inv) => (
                          <TableRow key={inv.id} className="bg-muted/20 text-xs">
                            <TableCell />
                            <TableCell className="pl-6 font-mono text-muted-foreground">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {inv.customerName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatINR(inv.subtotal)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatINR(inv.discount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatINR(inv.tax)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatINR(inv.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>{t("total")}</TableCell>
                    <TableCell className="text-right tabular-nums">{sales.totals.invoices}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(sales.totals.subtotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(sales.totals.discount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(sales.totals.tax)}</TableCell>
                    <TableCell className="text-right font-display font-bold tabular-nums">
                      {formatINR(sales.totals.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </TabsContent>

        {/* ──────── PURCHASES TAB ──────── */}
        <TabsContent value="purchases" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {purchases
                ? `${purchases.totals.purchases ?? 0} purchases · ${loadedRange.from} → ${loadedRange.to}`
                : " "}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!purchases}
              onClick={() =>
                purchases &&
                downloadCsv(
                  `purchases-report-${from}-${to}.csv`,
                  ["Date", "Purchases", "Subtotal", "Tax", "Total"],
                  purchases.rows.map((r) => [r.date, r.purchaseCount ?? 0, r.subtotal, r.tax, r.total]),
                )
              }
            >
              <Download className="size-3.5 mr-1" /> {t("exportCsv")}
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            {loading && !purchases ? (
              <TableSkeleton rows={6} className="h-9" />
            ) : purchases ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">{t("subtotal")}</TableHead>
                    <TableHead className="text-right">{t("tax")}</TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.rows.length === 0 && (
                    <EmptyTableRow colSpan={5} message={t("noData")} />
                  )}
                  {purchases.rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="font-medium">{r.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.purchaseCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.tax)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatINR(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>{t("total")}</TableCell>
                    <TableCell className="text-right font-display font-bold tabular-nums">
                      {formatINR(purchases.totals.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </TabsContent>

        {/* ──────── STOCK TAB ──────── */}
        <TabsContent value="stock" className="space-y-3 mt-3">
          <Tabs defaultValue="current">
            <TabsList className="h-8 text-xs">
              <TabsTrigger value="current" className="text-xs">{t("currentStock")}</TabsTrigger>
              <TabsTrigger value="movements" className="text-xs">{t("stockMovements")}</TabsTrigger>
            </TabsList>

            {/* Current Stock */}
            <TabsContent value="current" className="space-y-3 mt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t("search")}
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{filteredStock.length} products ·</span>
                  <span className="font-semibold text-foreground">{formatINR(stockValue)} total value</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredStock.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `stock-current-${today}.csv`,
                      ["Product", "SKU", "Category", "Unit", "In Stock", "Purchase Price", "Valuation"],
                      filteredStock.map((r) => [
                        r.name,
                        r.sku ?? "",
                        r.category ?? "",
                        r.unit,
                        r.balance,
                        r.purchasePrice,
                        r.balance * r.purchasePrice,
                      ]),
                    )
                  }
                >
                  <Download className="size-3.5 mr-1" /> {t("exportCsv")}
                </Button>
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                {loading ? (
                  <TableSkeleton rows={8} className="h-9" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("productName")}</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>{t("category")}</TableHead>
                        <TableHead className="text-right">{t("inStock")}</TableHead>
                        <TableHead className="text-right">{t("purchasePrice")}</TableHead>
                        <TableHead className="text-right">Valuation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStock.length === 0 && (
                        <EmptyTableRow colSpan={6} message={t("noData")} />
                      )}
                      {filteredStock.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {r.name}
                            {r.isLow && (
                              <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1">
                                Low
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.sku ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.category ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.balance} {r.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.purchasePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatINR(r.balance * r.purchasePrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Stock Movements */}
            <TabsContent value="movements" className="space-y-3 mt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t("search")}
                    value={stockMovSearch}
                    onChange={(e) => setStockMovSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Valuation:{" "}
                  <span className="font-semibold text-foreground">
                    {formatINR(stockMovements?.totalValuation ?? 0)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredMov.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `stock-movements-${from}-${to}.csv`,
                      ["Product", "SKU", "Unit", "Opening", "Stock In", "Stock Out", "Closing", "Purchase Price", "Valuation"],
                      filteredMov.map((r) => [
                        r.productName,
                        r.sku ?? "",
                        r.unit,
                        r.openingQty,
                        r.stockIn,
                        r.stockOut,
                        r.closingQty,
                        r.purchasePrice,
                        r.valuation,
                      ]),
                    )
                  }
                >
                  <Download className="size-3.5 mr-1" /> {t("exportCsv")}
                </Button>
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                {loading ? (
                  <TableSkeleton rows={8} className="h-9" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("productName")}</TableHead>
                        <TableHead className="text-right">{t("openingQty")}</TableHead>
                        <TableHead className="text-right">{t("stockIn")}</TableHead>
                        <TableHead className="text-right">{t("stockOut")}</TableHead>
                        <TableHead className="text-right">{t("closingQty")}</TableHead>
                        <TableHead className="text-right">{t("purchasePrice")}</TableHead>
                        <TableHead className="text-right">{t("valuation")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMov.length === 0 && (
                        <EmptyTableRow colSpan={7} message={t("noData")} />
                      )}
                      {filteredMov.map((r) => (
                        <TableRow key={r.productId}>
                          <TableCell className="font-medium">
                            {r.productName}
                            {r.category && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">{r.category}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{r.openingQty}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{r.stockIn}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-red-500">
                            -{r.stockOut}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{r.closingQty} {r.unit}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.purchasePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatINR(r.valuation)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ──────── GST SUMMARY TAB ──────── */}
        <TabsContent value="gst" className="space-y-4 mt-3">
          {loading && !gst ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 h-20 animate-pulse" />
              ))}
            </div>
          ) : gst ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard
                  label={t("taxableValue")}
                  value={formatINR(gst.totalTaxableValue)}
                  icon={ReceiptText}
                />
                <StatCard label={t("cgst")} value={formatINR(gst.totalCgst)} />
                <StatCard label={t("sgst")} value={formatINR(gst.totalSgst)} />
                <StatCard label={t("igst")} value={formatINR(gst.totalIgst)} />
                <StatCard
                  label={t("totalTaxCollected")}
                  value={formatINR(gst.totalTax)}
                  icon={FileBarChart2}
                />
              </div>

              {/* Rate-wise Breakup */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("gstRateBreakup")}</h3>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("gstRate")}</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">{t("taxableValue")}</TableHead>
                        <TableHead className="text-right">{t("cgst")}</TableHead>
                        <TableHead className="text-right">{t("sgst")}</TableHead>
                        <TableHead className="text-right">{t("totalTaxCollected")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gst.rateBreakup.length === 0 && (
                        <EmptyTableRow colSpan={6} message={t("noData")} />
                      )}
                      {gst.rateBreakup.map((rb) => (
                        <TableRow key={rb.rate}>
                          <TableCell className="font-semibold">{rb.rate}%</TableCell>
                          <TableCell className="text-right tabular-nums">{rb.invoiceCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(rb.taxableValue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(rb.cgst)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(rb.sgst)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatINR(rb.totalTax)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* GSTR-1 Invoice List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("gstr1Invoices")}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gst.invoices.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `gstr1-${from}-${to}.csv`,
                        [
                          "Invoice #",
                          "Date",
                          "Customer",
                          "GSTIN",
                          "GST Rate %",
                          "Taxable Value",
                          "CGST",
                          "SGST",
                          "IGST",
                          "Tax Amount",
                          "Total",
                        ],
                        gst.invoices.map((r) => [
                          r.invoiceNumber,
                          r.date,
                          r.customerName,
                          r.gstin ?? "",
                          r.gstRate,
                          r.taxableValue,
                          r.cgst,
                          r.sgst,
                          r.igst,
                          r.taxAmount,
                          r.total,
                        ]),
                      )
                    }
                  >
                    <Download className="size-3.5 mr-1" /> {t("exportGstr1")}
                  </Button>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("customer")}</TableHead>
                        <TableHead>GSTIN</TableHead>
                        <TableHead className="text-right">{t("gstRate")}</TableHead>
                        <TableHead className="text-right">{t("taxableValue")}</TableHead>
                        <TableHead className="text-right">{t("taxAmount")}</TableHead>
                        <TableHead className="text-right">{t("total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gst.invoices.length === 0 && (
                        <EmptyTableRow colSpan={8} message={t("noData")} />
                      )}
                      {gst.invoices.map((inv, idx) => (
                        <TableRow key={`${inv.invoiceNumber}-${inv.gstRate}-${idx}`}>
                          <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{inv.date}</TableCell>
                          <TableCell className="text-xs">{inv.customerName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inv.gstin ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{inv.gstRate}%</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(inv.taxableValue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(inv.taxAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatINR(inv.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* ──────── P&L TAB ──────── */}
        <TabsContent value="pnl" className="space-y-4 mt-3">
          {loading && !pnl ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card p-4 h-20 animate-pulse" />
              ))}
            </div>
          ) : pnl ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard
                  label={t("revenue")}
                  value={formatINR(pnl.revenue)}
                  icon={TrendingUp}
                />
                <StatCard
                  label={t("cogs")}
                  value={formatINR(pnl.cogs)}
                  sub={pct(pnl.cogs, pnl.revenue) + " of revenue"}
                />
                <StatCard
                  label={t("grossProfit")}
                  value={formatINR(pnl.grossProfit)}
                  sub={`${pnl.grossMarginPct}% ${t("grossMargin")}`}
                  positive={pnl.grossProfit >= 0}
                  icon={pnl.grossProfit >= 0 ? TrendingUp : TrendingDown}
                />
                <StatCard
                  label={t("expenses")}
                  value={formatINR(pnl.expenses)}
                />
              </div>
              {/* Net Profit prominent card */}
              <div
                className={`rounded-xl border p-4 flex items-center justify-between ${
                  pnl.netProfit >= 0
                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                }`}
              >
                <div>
                  <p className="text-xs text-muted-foreground">{t("netProfit")}</p>
                  <p
                    className={`text-2xl font-display font-bold tabular-nums mt-0.5 ${
                      pnl.netProfit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatINR(pnl.netProfit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("netMargin")}</p>
                  <p
                    className={`text-lg font-bold ${
                      pnl.netProfit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {pnl.netMarginPct}%
                  </p>
                </div>
              </div>

              {/* Daily Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("dailyBreakdown")}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pnl.trend.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `pnl-report-${from}-${to}.csv`,
                        ["Date", "Revenue", "COGS", "Gross Profit", "Expenses", "Net Profit"],
                        pnl.trend.map((r) => [
                          r.period,
                          r.revenue,
                          r.cogs,
                          r.grossProfit,
                          r.expenses,
                          r.netProfit,
                        ]),
                      )
                    }
                  >
                    <Download className="size-3.5 mr-1" /> {t("exportCsv")}
                  </Button>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead className="text-right">{t("revenue")}</TableHead>
                        <TableHead className="text-right">{t("cogs")}</TableHead>
                        <TableHead className="text-right">{t("grossProfit")}</TableHead>
                        <TableHead className="text-right">{t("expenses")}</TableHead>
                        <TableHead className="text-right">{t("netProfit")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pnl.trend.length === 0 && (
                        <EmptyTableRow colSpan={6} message={t("noData")} />
                      )}
                      {pnl.trend.map((r) => (
                        <TableRow key={r.period}>
                          <TableCell className="font-medium">{r.period}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatINR(r.cogs)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              r.grossProfit >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-500"
                            }`}
                          >
                            {formatINR(r.grossProfit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatINR(r.expenses)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-semibold ${
                              r.netProfit >= 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-red-500"
                            }`}
                          >
                            {formatINR(r.netProfit)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>{t("total")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(pnl.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(pnl.cogs)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(pnl.grossProfit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(pnl.expenses)}</TableCell>
                        <TableCell
                          className={`text-right font-display font-bold tabular-nums ${
                            pnl.netProfit >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-500"
                          }`}
                        >
                          {formatINR(pnl.netProfit)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}