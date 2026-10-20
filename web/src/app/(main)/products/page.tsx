"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Activity,
  Eye,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { apiDownload, apiFetch, ApiError, isAbortError } from "@/lib/api";
import { cachedFetch, invalidateCache } from "@/lib/session-cache";
import { useAuth } from "@/lib/auth-store";
import { formatINR, formatQty, formatDateTime } from "@/lib/format";
import { STOCK_MOVE_BADGE } from "@/lib/badges";
import type { Product, ProductSummary, StockMovement } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SummaryCards from "./summary-cards";
import ProductTableSkeleton from "./product-table-skeleton";
import ProductFormDialog, { type ProductSavedPayload } from "./product-form-dialog";
import StockAdjustDialog from "./stock-adjust-dialog";
import ProductDetailsSheet from "./product-details-sheet";
import ImportDialog, { type ImportResult } from "./import-dialog";
import StockCandlestick from "./stock-candlestick";
import { TableSearch } from "@/components/shared/table-search";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";

const LIMIT = 50;

function stockBadge(p: Product) {
  const s = Number(p.stock);
  if (s <= 0) return <Badge variant="outline" className="border-destructive/40 text-destructive">Out</Badge>;
  if (p.isLow) return <Badge variant="outline" className="border-royal-300 bg-royal-50 text-royal-700">Low</Badge>;
  return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{formatQty(s)}</Badge>;
}

function expiryLabel(p: Product) {
  if (!p.expiryDate) return "—";
  const key = String(p.expiryDate).slice(0, 10);
  const parsed = new Date(key);
  if (Number.isNaN(parsed.getTime())) return "—";
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const dateText = parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (key < todayKey) {
    return <span className="font-medium text-destructive">{dateText} · Expired</span>;
  }
  return dateText;
}

interface ProductRowProps {
  product: Product;
  showPurchase: boolean;
  canManage: boolean;
  canArchive: boolean;
  canDelete: boolean;
  busy: boolean;
  onDetails: (p: Product) => void;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  onArchive: (p: Product) => void;
  onDelete: (p: Product) => void;
}

/**
 * Memoized row: changing one product (edit/archive/restore/adjust) only
 * re-renders that row, not the whole table.
 */
const ProductRow = memo(function ProductRow({
  product,
  showPurchase,
  canManage,
  canArchive,
  canDelete,
  busy,
  onDetails,
  onEdit,
  onAdjust,
  onArchive,
  onDelete,
}: ProductRowProps) {
  return (
    <TableRow className={product.isArchived ? "opacity-70" : undefined}>
      <TableCell>
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.sku || product.barcode || "—"}</p>
      </TableCell>
      <TableCell className="text-muted-foreground">{product.category ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{expiryLabel(product)}</TableCell>
      {showPurchase ? (
        <TableCell className="text-right tabular-nums text-muted-foreground">{formatINR(product.purchasePrice)}</TableCell>
      ) : null}
      <TableCell className="text-right font-medium tabular-nums">{formatINR(product.sellingPrice)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{product.gstPercent}%</TableCell>
      <TableCell className="text-right">{product.isArchived ? <Badge className="bg-muted text-muted-foreground">Archived</Badge> : stockBadge(product)}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onDetails(product)}>
              <Eye className="size-4" /> Details
            </DropdownMenuItem>
            {canManage ? (
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
            ) : null}
            {canManage && !product.isArchived ? (
              <DropdownMenuItem onClick={() => onAdjust(product)}>
                <SlidersHorizontal className="size-4" /> Adjust stock
              </DropdownMenuItem>
            ) : null}
            {canArchive ? (
              <DropdownMenuItem disabled={busy} onClick={() => onArchive(product)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : product.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                {busy
                  ? product.isArchived ? "Restoring…" : "Archiving…"
                  : product.isArchived ? "Restore" : "Archive"}
              </DropdownMenuItem>
            ) : null}
            {canDelete && product.isArchived ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={busy}
                  onClick={() => onDelete(product)}
                >
                  <Trash2 className="size-4" /> Delete permanently
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

export default function ProductsPage() {
  const user = useAuth((s) => s.user);
  const role = user?.role ?? null;
  const storeId = user?.storeId;
  const canManage = role !== null && role !== "CASHIER";
  const canArchive = role === "OWNER" || role === "MANAGER";
  const canDelete = role === "OWNER";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockStatus, setStockStatus] = useState<"all" | "in" | "low" | "out">("all");
  const [archived, setArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [mvTotal, setMvTotal] = useState(0);
  const [mvType, setMvType] = useState("all");
  const [mvPage, setMvPage] = useState(1);
  const [mvLoading, setMvLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshTick((n) => n + 1), []);
  const [mvProduct, setMvProduct] = useState("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);
  const [chartMoves, setChartMoves] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState("products");

  // Refs for optimistic rollbacks + background-refresh decisions.
  const productsRef = useRef(products);
  const totalRef = useRef(total);
  const movementsRef = useRef(movements);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { movementsRef.current = movements; }, [movements]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const resetPage = () => setPage(1);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(LIMIT));
    if (archived) params.set("archived", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (category !== "all") params.set("category", category);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);
    return params.toString();
  }, [page, archived, debouncedSearch, category, stockStatus]);

  // Core list loader. Never blanks the current table: a soft `refreshing`
  // flag drives a small inline indicator instead of a full skeleton.
  const loadList = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiFetch<{
        products: Product[];
        total: number;
        summary: ProductSummary;
      }>(`/api/products?${listParams}`, { signal });
      setProducts(data.products);
      setTotal(data.total);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof ApiError ? err.message : "Failed to load products");
    }
  }, [listParams]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setRefreshing(true);
      void loadList(ctrl.signal).finally(() => {
        if (!ctrl.signal.aborted) setRefreshing(false);
        setInitialLoading(false);
      });
    }, 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [loadList]);

  useEffect(() => {
    const sid = user?.storeId;
    if (!sid) return;
    let cancelled = false;
    const t = setTimeout(() => {
      cachedFetch(`categories:${sid}`, () => apiFetch<{ categories: string[] }>("/api/products/categories"))
        .then((d) => { if (!cancelled) setCategories(d.categories ?? []); })
        .catch(() => { if (!cancelled) setCategories([]); });
    }, 0);
    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [user?.storeId]);

  const matchesFilters = useCallback((p: Product) => {
    if (Boolean(p.isArchived) !== Boolean(archived)) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const hay = `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (category !== "all" && p.category !== category) return false;
    const stock = Number(p.stock);
    if (stockStatus === "in" && stock <= 0) return false;
    if (stockStatus === "low" && !(stock < Number(p.minStock))) return false;
    if (stockStatus === "out" && stock > 0) return false;
    return true;
  }, [archived, debouncedSearch, category, stockStatus]);

  const applyCreated = useCallback((p: Product, summary: ProductSummary | null) => {
    if (p.category) {
      setCategories((prev) => (prev.includes(p.category as string) ? prev : [...prev, p.category as string]));
    }
    setProductOptions((prev) => (prev.some((o) => o.id === p.id) ? prev : [{ id: p.id, name: p.name }, ...prev]));
    if (storeId) invalidateCache(`categories:${storeId}`);
    if (matchesFilters(p)) {
      setProducts((prev) => [p, ...prev].slice(0, LIMIT));
      setTotal((t) => t + 1);
    }
    if (summary) setSummary(summary);
    bumpRefresh();
  }, [matchesFilters, storeId, bumpRefresh]);

  const applyUpdated = useCallback((p: Product, summary: ProductSummary | null) => {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)).filter(matchesFilters));
    if (p.category) {
      setCategories((prev) => (prev.includes(p.category as string) ? prev : [...prev, p.category as string]));
    }
    if (storeId) invalidateCache(`categories:${storeId}`);
    if (summary) setSummary(summary);
    bumpRefresh();
  }, [matchesFilters, storeId, bumpRefresh]);

  const handleSaved = useCallback((payload: ProductSavedPayload) => {
    if (editing) applyUpdated(payload.product, payload.summary);
    else applyCreated(payload.product, payload.summary);
  }, [editing, applyUpdated, applyCreated]);

  // Optimistic archive/restore with rollback.
  const toggleArchive = useCallback(async (p: Product) => {
    const target = !p.isArchived;
    const rollback = { products: productsRef.current, total: totalRef.current };
    setBusyId(p.id);
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await apiFetch<{ archived: boolean; summary: ProductSummary }>(
        `/api/products/${p.id}/archive`,
        { method: "PATCH", body: { archived: target } },
      );
      toast.success(res.archived ? "Product archived" : "Product restored");
      if (res.summary) setSummary(res.summary);
      bumpRefresh();
    } catch (err) {
      if (isAbortError(err)) return;
      setProducts(rollback.products);
      setTotal(rollback.total);
      toast.error(err instanceof ApiError ? err.message : "Failed to update product");
    } finally {
      setBusyId(null);
    }
  }, [bumpRefresh]);

  // Optimistic permanent delete with rollback.
  const performDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const rollback = { products: productsRef.current, total: totalRef.current };
    setProducts((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await apiFetch<{ ok: boolean; summary: ProductSummary }>(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Product permanently deleted");
      setDeleteTarget(null);
      if (res.summary) setSummary(res.summary);
      bumpRefresh();
    } catch (err) {
      if (isAbortError(err)) return;
      setProducts(rollback.products);
      setTotal(rollback.total);
      toast.error(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, bumpRefresh]);

  const handleAdjusted = useCallback((productId: string, balanceAfter: number) => {
    setProducts((prev) =>
      prev.map((x) =>
        x.id === productId ? { ...x, stock: balanceAfter, isLow: balanceAfter < Number(x.minStock) } : x,
      ),
    );
    void apiFetch<{ summary: ProductSummary }>("/api/products/summary")
      .then((d) => setSummary(d.summary))
      .catch(() => undefined);
    bumpRefresh();
  }, [bumpRefresh]);

  const refreshProductOptions = useCallback(async () => {
    try {
      const d = await apiFetch<{ products: Product[] }>("/api/products?page=1&limit=200");
      setProductOptions((d.products ?? []).map((p) => ({ id: p.id, name: p.name })));
    } catch {
      /* keep previous options */
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "movements" || productOptions.length > 0) return;
    const t = setTimeout(() => void refreshProductOptions(), 0);
    return () => clearTimeout(t);
  }, [activeTab, productOptions.length, refreshProductOptions]);

  const handleImported = useCallback((result: ImportResult) => {
    if (result.summary) setSummary(result.summary);
    if (result.imported + result.updated === 0) return;
    if (storeId) invalidateCache(`categories:${storeId}`);
    setRefreshing(true);
    void loadList().finally(() => {
      setRefreshing(false);
      setInitialLoading(false);
    });
    void refreshProductOptions();
  }, [loadList, refreshProductOptions, storeId]);

  const loadMovements = useCallback(async () => {
    if (movementsRef.current.length === 0) setMvLoading(true);
    try {
      const params = new URLSearchParams({ page: String(mvPage), limit: "50" });
      if (mvType !== "all") params.set("type", mvType);
      if (mvProduct !== "all") params.set("productId", mvProduct);
      const data = await apiFetch<{ movements: StockMovement[]; total: number }>(`/api/inventory/movements?${params}`);
      setMovements(data.movements);
      setMvTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load movements");
    } finally {
      setMvLoading(false);
    }
  }, [mvPage, mvType, mvProduct]);

  useEffect(() => {
    if (activeTab !== "movements") return;
    const t = setTimeout(() => void loadMovements(), 0);
    return () => clearTimeout(t);
  }, [activeTab, loadMovements, refreshTick]);

  useEffect(() => {
    if (activeTab !== "movements") return;
    if (mvProduct === "all") {
      const t = setTimeout(() => setChartMoves([]), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      apiFetch<{ movements: StockMovement[] }>(
        `/api/inventory/movements?productId=${encodeURIComponent(mvProduct)}&limit=200`,
      )
        .then((d) => setChartMoves(d.movements))
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(t);
  }, [activeTab, mvProduct, refreshTick]);

  useEffect(() => {
    if (activeTab !== "movements") return;
    const id = setInterval(() => bumpRefresh(), 10000);
    return () => clearInterval(id);
  }, [activeTab, bumpRefresh]);

  const exportFilters = () => {
    const params = new URLSearchParams();
    if (archived) params.set("archived", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (category !== "all") params.set("category", category);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);
    return params.toString();
  };

  const runExport = async (kind: "pdf" | "xlsx") => {
    setExporting(kind);
    try {
      await apiDownload(
        `/api/products/export/${kind}?${exportFilters()}`,
        kind === "pdf" ? "products-report.pdf" : "products.xlsx",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

const pages = Math.max(1, Math.ceil(total / LIMIT));
const mvPages = Math.max(1, Math.ceil(mvTotal / 50));
const showPurchase = canManage;

  const openDetails = useCallback((p: Product) => setDetailId(p.id), []);
  const openEdit = useCallback((p: Product) => { setEditing(p); setFormOpen(true); }, []);
  const openAdjust = useCallback((p: Product) => setAdjusting(p), []);
  const askDelete = useCallback((p: Product) => setDeleteTarget(p), []);

  const renderFilters = () => (
    <div className="space-y-3">
      <TableSearch
        value={search}
        onChange={(v) => { setSearch(v); resetPage(); }}
        placeholder="Search by name, SKU or barcode…"
        className="w-full"
        inputClassName="pl-9 pr-9"
      >
        {refreshing && products.length > 0 ? (
          <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </TableSearch>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={category} onValueChange={(v) => { setCategory(v); resetPage(); }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockStatus} onValueChange={(v) => { setStockStatus(v as "all" | "in" | "low" | "out"); resetPage(); }}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <Label htmlFor="show-archived" className="text-sm text-muted-foreground">Archived</Label>
        <Switch id="show-archived" checked={archived} onCheckedChange={(v) => { setArchived(v); resetPage(); }} />
      </div>
      <Button variant="outline" className="w-full" onClick={() => setMobileFiltersOpen(false)}>
        Apply filters
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Products</h1>
          <p className="text-xs text-muted-foreground">
            {archived ? "Viewing archived products" : "Manage your products, inventory and pricing."}
            {summary?.value != null && !archived ? (
              <span className="ml-2">
                · Stock value <span className="font-semibold tabular-nums">{formatINR(summary.value)}</span>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Bulk Upload
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => void runExport("pdf")}>
                <FileDown className="size-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runExport("xlsx")}>
                <FileSpreadsheet className="size-4" /> Export as Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void apiDownload("/api/products/template.csv", "products-template.csv")}>
                <FileSpreadsheet className="size-4" /> Download CSV template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void apiDownload("/api/products/template.xlsx", "products-template.xlsx")}>
                <FileSpreadsheet className="size-4" /> Download Excel template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Add product
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products" onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="size-3.5" /> Products
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <Activity className="size-3.5" /> Stock movements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <SummaryCards summary={summary} loading={initialLoading && !summary} />

          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <div className="hidden md:block md:flex-1">
              <TableSearch
                value={search}
                onChange={(v) => { setSearch(v); resetPage(); }}
                placeholder="Search by name, SKU or barcode…"
                className="w-full"
                inputClassName="pl-9 pr-9"
              >
                {refreshing && products.length > 0 ? (
                  <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </TableSearch>
            </div>
            <div className="flex gap-2 md:hidden">
              <Button variant="outline" className="flex-1" onClick={() => setMobileFiltersOpen(true)}>Filters</Button>
              {search || category !== "all" || stockStatus !== "all" || archived ? (
                <Button variant="ghost" className="flex-1" onClick={() => { setSearch(""); setCategory("all"); setStockStatus("all"); setArchived(false); setPage(1); }}>
                  Reset
                </Button>
              ) : null}
            </div>
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              <Select value={category} onValueChange={(v) => { setCategory(v); resetPage(); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockStatus} onValueChange={(v) => { setStockStatus(v as "all" | "in" | "low" | "out"); resetPage(); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock</SelectItem>
                  <SelectItem value="in">In stock</SelectItem>
                  <SelectItem value="low">Low stock</SelectItem>
                  <SelectItem value="out">Out of stock</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="show-archived" checked={archived} onCheckedChange={(v) => { setArchived(v); resetPage(); }} />
                <Label htmlFor="show-archived" className="text-sm text-muted-foreground">Archived</Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            {initialLoading && products.length === 0 ? (
              <ProductTableSkeleton showPurchase={showPurchase} />
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={() => { void loadList(); }}>
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              </div>
            ) : products.length === 0 ? (
              <EmptyState message={archived ? "No archived products." : "No products found."}>
                {!archived ? (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditing(null); setFormOpen(true); }}>
                    <Plus className="size-3.5" /> Add your first product
                  </Button>
                ) : null}
              </EmptyState>
            ) : (
              <>
                <div className="flex items-center justify-end border-b px-3 py-1.5">
                  {refreshing ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Updating…
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {total} result{total === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Expiry</TableHead>
                        {showPurchase ? <TableHead className="text-right">Purchase</TableHead> : null}
                        <TableHead className="text-right">Selling</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="w-14 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <ProductRow
                          key={p.id}
                          product={p}
                          showPurchase={showPurchase}
                          canManage={canManage}
                          canArchive={canArchive}
                          canDelete={canDelete}
                          busy={busyId === p.id}
                          onDetails={openDetails}
                          onEdit={openEdit}
                          onAdjust={openAdjust}
                          onArchive={toggleArchive}
                          onDelete={askDelete}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 p-3 md:hidden">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full rounded-xl border border-navy-100 bg-white p-3 text-left shadow-sm"
                      onClick={() => openDetails(p)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-50 text-sm font-bold text-navy-700">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy-900">{p.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{p.category ?? "Uncategorized"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums text-navy-900">{formatINR(p.sellingPrice)}</p>
                          {stockBadge(p)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Pager
            page={page}
            pages={pages}
            onPageChange={setPage}
            summary={`Page ${page} of ${pages} · ${total} result${total === 1 ? "" : "s"}`}
            prevLabel="Previous"
          />
        </TabsContent>

        <TabsContent value="movements" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={mvProduct} onValueChange={(v) => { setMvProduct(v); setMvPage(1); }}>
                <SelectTrigger className="w-52"><SelectValue placeholder="All products" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All products</SelectItem>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mvType} onValueChange={(v) => { setMvType(v); setMvPage(1); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="OPENING">Opening stock</SelectItem>
                  <SelectItem value="PURCHASE">From purchase</SelectItem>
                  <SelectItem value="SALE">From sale</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="REVERSAL">Reversal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Stock is derived from the movement ledger (immutable history · refreshes live)
            </span>
          </div>

          {mvProduct !== "all" ? (
            <StockCandlestick movements={chartMoves} />
          ) : null}

          <div className="rounded-lg border bg-card">
            {mvLoading && movements.length === 0 ? (
              <TableSkeleton rows={8} />
            ) : movements.length === 0 ? (
              <EmptyState message="No stock movements yet." />
            ) : (
              <>
                {mvLoading ? (
                  <div className="flex items-center justify-end border-b px-3 py-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Updating…
                    </span>
                  </div>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Balance after</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            title="Show candlestick chart for this product"
                            onClick={() => { setMvProduct(m.productId); setMvPage(1); }}
                            className="rounded text-left font-medium decoration-primary/40 underline-offset-2 hover:underline"
                          >
                            {m.productName}
                          </button>
                          {mvProduct === m.productId ? <span className="ml-1 text-xs text-primary">●</span> : null}
                        </TableCell>
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

      <ProductFormDialog
        key={formOpen ? (editing?.id ?? "new") : "closed"}
        open={formOpen}
        setOpen={setFormOpen}
        editing={editing}
        onSaved={handleSaved}
        onDuplicate={(id) => { setFormOpen(false); setDetailId(id); }}
      />

      <StockAdjustDialog product={adjusting} setProduct={setAdjusting} onChanged={handleAdjusted} />

      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent className="inset-x-0 bottom-0 top-auto z-50 max-h-[84vh] translate-y-0 rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,520px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          {renderFilters()}
          <DialogFooter className="mt-2 flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setMobileFiltersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailsSheet
        key={detailId ?? "closed"}
        productId={detailId}
        setProductId={setDetailId}
        onEdit={(p) => { setEditing(p); setFormOpen(true); }}
        onAdjust={setAdjusting}
        onToggleArchive={toggleArchive}
        onDelete={setDeleteTarget}
        canManage={canManage}
        canArchive={canArchive}
        canDelete={canDelete}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleImported} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; is archived. Permanently deleting it removes it from your records
              and cannot be undone. Archived stock movements remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void performDelete(); }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}