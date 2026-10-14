"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArchiveRestore,
  Box,
  CalendarClock,
  Loader2,
  PackageOpen,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Product, StockMovement } from "@/lib/types";
import { formatINR, formatQty, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  productId: string | null;
  setProductId: (id: string | null) => void;
  onEdit: (p: Product) => void;
  onAdjust: (p: Product) => void;
  onToggleArchive: (p: Product) => Promise<void>;
  onDelete: (p: Product) => void;
  canManage?: boolean;
  canArchive?: boolean;
  canDelete?: boolean;
}

function movementMeta(type: string) {
  switch (type) {
    case "OPENING": return { label: "Opening", tone: "bg-sky-50 text-sky-700" };
    case "PURCHASE": return { label: "Purchase", tone: "bg-emerald-50 text-emerald-700" };
    case "SALE": return { label: "Sale", tone: "bg-royal-50 text-royal-700" };
    case "ADJUSTMENT": return { label: "Adjustment", tone: "bg-amber-50 text-amber-700" };
    case "REVERSAL": return { label: "Reversal", tone: "bg-destructive/10 text-destructive" };
    default: return { label: type, tone: "bg-muted text-muted-foreground" };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}

export default function ProductDetailsSheet({
  productId,
  setProductId,
  onEdit,
  onAdjust,
  onToggleArchive,
  onDelete,
  canManage = true,
  canArchive = true,
  canDelete = false,
}: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    apiFetch<{ product: Product; movements: StockMovement[] }>(`/api/products/${productId}`)
      .then((d) => {
        if (cancelled) return;
        setProduct(d.product);
        setMovements(d.movements);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : "Could not load product details");
        setProductId(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, setProductId]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      setProductId(null);
      setProduct(null);
      setMovements([]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const hasPurchase = "purchasePrice" in (product ?? {}) && product?.purchasePrice != null;

  return (
    <Dialog open={!!productId} onOpenChange={(v) => { if (!v) setProductId(null); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {loading || !product ? (
          <div className="space-y-3 pt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-3">
                <span className="font-display text-lg">{product.name}</span>
                {product.isArchived ? (
                  <Badge className="shrink-0 bg-muted text-muted-foreground">Archived</Badge>
                ) : product.isLow ? (
                  <Badge variant="outline" className="shrink-0 border-royal-300 bg-royal-50 text-royal-700">Low stock</Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="SKU">{product.sku || "—"}</Field>
              <Field label="Barcode">{product.barcode || "—"}</Field>
              <Field label="Category">{product.category || "—"}</Field>
              <Field label="Unit">{product.unit}</Field>
            </div>

            {product.description ? (
              <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{product.description}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-between rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex size-9 items-center justify-center rounded-md ${
                  Number(product.stock) <= 0
                    ? "bg-destructive/10 text-destructive"
                    : Number(product.stock) < Number(product.minStock)
                      ? "bg-royal-50 text-royal-600"
                      : "bg-emerald-50 text-emerald-600"
                }`}>
                  <Box className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{formatQty(product.stock)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    in stock · low at {formatQty(product.minStock)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 text-right text-xs">
                <div>
                  <p className="text-muted-foreground">Selling</p>
                  <p className="font-medium tabular-nums">{formatINR(product.sellingPrice)}</p>
                </div>
                {hasPurchase ? (
                  <div>
                    <p className="text-muted-foreground">Purchase</p>
                    <p className="font-medium tabular-nums">{formatINR(product.purchasePrice)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground">MRP</p>
                  <p className="font-medium tabular-nums">{product.mrp != null ? formatINR(product.mrp) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GST</p>
                  <p className="font-medium tabular-nums">{product.gstPercent}%</p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <Field label="Low stock threshold">{formatQty(product.minStock)} {product.unit}</Field>
              <Field label="Supplier">{product.supplier || "—"}</Field>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="size-3.5" /> History
              </p>
              <div className="rounded-md border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Created</span>
                  <span className="tabular-nums">{formatDateTime(product.createdAt)}</span>
                </div>
              </div>
              <div className="rounded-md border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="tabular-nums">{formatDateTime(product.updatedAt)}</span>
                </div>
              </div>
              {product.archivedAt ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Archived by {product.archivedByName || "?"}</span>
                    <span className="tabular-nums">{formatDateTime(product.archivedAt)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <Separator className="my-4" />

            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <PackageOpen className="size-3.5" /> Recent movements
              </p>
              {movements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No stock movements yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {movements.map((m) => {
                    const meta = movementMeta(m.type);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${meta.tone}`}>{meta.label}</span>
                          <span className="truncate text-xs text-muted-foreground">{m.note || "—"}</span>
                        </div>
                        <span className={`shrink-0 tabular-nums ${Number(m.qty) < 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {Number(m.qty) > 0 ? "+" : ""}{formatQty(m.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <div className="flex gap-2">
                {canManage ? (
                  <Button variant="outline" className="flex-1" onClick={() => { onEdit(product); setProductId(null); }}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                ) : null}
                {!product.isArchived && canManage ? (
                  <Button variant="outline" className="flex-1" onClick={() => { onAdjust(product); setProductId(null); }}>
                    <PlusCircle className="size-3.5" /> Adjust
                  </Button>
                ) : null}
              </div>
              {product.isArchived ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-emerald-600"
                    disabled={busy === "restore" || !canArchive}
                    onClick={() => void runAction("restore", async () => { await onToggleArchive(product); })}
                  >
                    {busy === "restore" ? <Loader2 className="size-3.5 animate-spin" /> : <ArchiveRestore className="size-3.5" />}
                    Restore
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive"
                      disabled={busy === "delete"}
                      onClick={() => { onDelete(product); setProductId(null); setProduct(null); setMovements([]); }}
                    >
                      {busy === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : canArchive ? (
                <Button
                  variant="outline"
                  className="w-full text-muted-foreground"
                  disabled={busy === "archive"}
                  onClick={() => void runAction("archive", async () => { await onToggleArchive(product); })}
                >
                  {busy === "archive" ? <Loader2 className="size-3.5 animate-spin" /> : <ArchiveIcon className="size-3.5" />}
                  Archive product
                </Button>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}