"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatQty, formatDateTime } from "@/lib/format";
import { STOCK_MOVE_BADGE, STOCK_LEVEL_BADGE } from "@/lib/badges";
import type { StockRow, StockMovement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSearch } from "@/components/shared/table-search";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";

export default function InventoryPage() {
  const { t } = useI18n();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [totalValue, setTotalValue] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [mvTotal, setMvTotal] = useState(0);
  const [mvType, setMvType] = useState("all");
  const [mvPage, setMvPage] = useState(1);
  const [mvLoading, setMvLoading] = useState(true);

  const loadStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams();
      if (lowOnly) params.set("lowOnly", "true");
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<{ stock: StockRow[] }>(`/api/inventory/stock/current?${params}`);
      setStock(data.stock);
      setTotalValue(data.stock.reduce((s, r) => s + r.balance * r.purchasePrice, 0));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load stock");
    } finally {
      setStockLoading(false);
    }
  }, [lowOnly, search]);

  useEffect(() => {
    void loadStock();
  }, [loadStock]);

  const loadMovements = useCallback(async () => {
    setMvLoading(true);
    try {
      const params = new URLSearchParams({ page: String(mvPage), limit: "50" });
      if (mvType !== "all") params.set("type", mvType);
      const data = await apiFetch<{ movements: StockMovement[]; total: number }>(`/api/inventory/movements?${params}`);
      setMovements(data.movements);
      setMvTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load movements");
    } finally {
      setMvLoading(false);
    }
  }, [mvPage, mvType]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const mvPages = Math.max(1, Math.ceil(mvTotal / 50));

  const renderFilters = () => (
    <div className="space-y-3">
      <TableSearch value={search} onChange={setSearch} className="w-full" />
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-sm text-muted-foreground">Low stock only</span>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
          {lowOnly ? "On" : "Off"}
        </Button>
      </div>
      <Button variant="outline" className="w-full" onClick={() => setMobileFiltersOpen(false)}>Apply</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">{t("navInventory")}</h1>
        <p className="text-xs text-muted-foreground">
          Stock is derived from the movement ledger (immutable history)
        </p>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">{t("currentStock")}</TabsTrigger>
          <TabsTrigger value="movements">{t("movements")}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <TableSearch value={search} onChange={setSearch} className="hidden flex-1 md:block" />
            <div className="flex gap-2 md:hidden">
              <Button variant="outline" className="flex-1" onClick={() => setMobileFiltersOpen(true)}>Filters</Button>
              <Button variant={lowOnly ? "default" : "outline"} className="flex-1" onClick={() => setLowOnly((v) => !v)}>
                {t("lowStock")} ({stock.filter((r) => r.isLow).length})
              </Button>
            </div>
            <div className="hidden md:flex md:items-center md:gap-2">
              <TableSearch value={search} onChange={setSearch} className="flex-1" />
              <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
                {t("lowStock")} ({stock.filter((r) => r.isLow).length})
              </Button>
            </div>
            <span className="text-sm text-muted-foreground md:ml-auto">
              Total value <span className="font-semibold tabular-nums">{formatINR(totalValue)}</span>
            </span>
          </div>

          <div className="rounded-lg border bg-card">
            {stockLoading ? (
              <TableSkeleton rows={8} />
            ) : stock.length === 0 ? (
              <EmptyState message={t("noData")} />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("productName")}</TableHead>
                        <TableHead>{t("category")}</TableHead>
                        <TableHead className="text-right">{t("inStock")}</TableHead>
                        <TableHead className="text-right">{t("minStock")}</TableHead>
                        <TableHead className="text-right">{t("purchasePrice")}</TableHead>
                        <TableHead className="text-right">{t("sellingPrice")}</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stock.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-muted-foreground">{r.category ?? "-"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatQty(r.balance)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatQty(r.minStock)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.purchasePrice)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(r.sellingPrice)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STOCK_LEVEL_BADGE[r.isLow ? "LOW" : "OK"]}>
                              {r.isLow ? t("lowStock") : "OK"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 p-3 md:hidden">
                  {stock.map((r) => (
                    <div key={r.id} className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground">{r.category ?? "-"}</p>
                        </div>
                        <Badge variant="outline" className={STOCK_LEVEL_BADGE[r.isLow ? "LOW" : "OK"]}>
                          {r.isLow ? t("lowStock") : "OK"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Stock</span>
                        <span className="font-semibold tabular-nums">{formatQty(r.balance)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-semibold tabular-nums">{formatINR(r.sellingPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="movements" className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Select value={mvType} onValueChange={(v) => { setMvType(v); setMvPage(1); }}>
              <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="OPENING">{t("openingStock")}</SelectItem>
                <SelectItem value="PURCHASE">{t("fromPurchase")}</SelectItem>
                <SelectItem value="SALE">{t("fromSale")}</SelectItem>
                <SelectItem value="ADJUSTMENT">{t("fromAdjustment")}</SelectItem>
                <SelectItem value="REVERSAL">{t("fromReversal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card">
            {mvLoading ? (
              <TableSkeleton rows={8} />
            ) : movements.length === 0 ? (
              <EmptyState message={t("noData")} />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("productName")}</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">{t("inStock")}</TableHead>
                        <TableHead className="text-right">{t("balanceAfter")}</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                          <TableCell className="font-medium">{m.productName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STOCK_MOVE_BADGE[m.type] ?? ""}>{m.type}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium tabular-nums ${Number(m.qty) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                            {Number(m.qty) > 0 ? "+" : ""}{formatQty(m.qty)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{m.balanceAfter != null ? formatQty(m.balanceAfter) : "-"}</TableCell>
                          <TableCell className="max-w-52 truncate text-xs text-muted-foreground">{m.note ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 p-3 md:hidden">
                  {movements.map((m) => (
                    <div key={m.id} className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">{m.productName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                        </div>
                        <Badge variant="outline" className={STOCK_MOVE_BADGE[m.type] ?? ""}>{m.type}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Qty</span>
                        <span className={`font-semibold tabular-nums ${Number(m.qty) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                          {Number(m.qty) > 0 ? "+" : ""}{formatQty(m.qty)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Balance</span>
                        <span className="font-semibold tabular-nums">{m.balanceAfter != null ? formatQty(m.balanceAfter) : "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <Pager
            page={mvPage}
            pages={mvPages}
            onPageChange={setMvPage}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto z-50 max-h-[80vh] translate-y-0 rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,420px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          {renderFilters()}
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setMobileFiltersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}