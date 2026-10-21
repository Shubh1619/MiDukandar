"use client";

import Link from "next/link";
import { PackageMinus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLowStockAlert, type LowStockItem } from "@/lib/use-low-stock-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function StockLine({ item }: { item: LowStockItem }) {
  return (
    <Link
      href={`/products?search=${encodeURIComponent(item.name)}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 transition-colors hover:border-amber-300"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-navy-900">{item.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.balance} left · minimum {item.minStock}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
        Low stock
      </span>
    </Link>
  );
}

/** Dismissible modal shown on the dashboard when products fall below minimum. */
export function LowStockAlertDialog() {
  const { items, hasAlerts, dismissed, dismiss, loading } = useLowStockAlert("dashboard");
  const open = !loading && hasAlerts && !dismissed;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="size-4 text-amber-600" />
            Low stock alert
          </DialogTitle>
          <DialogDescription>
            {items.length} product{items.length === 1 ? "" : "s"} at or below the minimum level. Restock before
            running out.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Needs restocking</p>
          {items.map((item) => (
            <StockLine key={item.id} item={item} />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Dismiss for now
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href="/products?lowStock=1">View products</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline banner variant for the inventory/products page. */
export function LowStockAlertBanner({ className }: { className?: string }) {
  const { items, hasAlerts, dismissed, dismiss, loading } = useLowStockAlert("inventory");
  if (loading || !hasAlerts || dismissed) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3",
        className,
      )}
    >
      <PackageMinus className="size-4 shrink-0 text-amber-700" />
      <p className="min-w-0 flex-1 text-xs text-navy-800">
        <span className="font-semibold">{items.length} product(s) at or below the minimum level.</span>
        {" — restock soon to avoid running out."}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="/products?lowStock=1">Review</Link>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss low stock alert">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
