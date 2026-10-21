"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, PackageX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExpiringProduct } from "@/lib/types";
import { useExpiryAlert } from "@/lib/use-expiry-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function expiryText(p: ExpiringProduct) {
  const key = String(p.expiryDate).slice(0, 10);
  const parsed = new Date(`${key}T00:00:00`);
  const dateText = Number.isNaN(parsed.getTime())
    ? key
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (p.daysLeft < 0) {
    const days = Math.abs(p.daysLeft);
    return `${dateText} · ${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (p.daysLeft === 0) return `${dateText} · expires today`;
  return `${dateText} · in ${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"}`;
}

function ProductLine({ product, tone }: { product: ExpiringProduct; tone: "danger" | "warn" }) {
  return (
    <Link
      href={`/products?search=${encodeURIComponent(product.name)}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
          : "border-amber-200 bg-amber-50 hover:border-amber-300",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-navy-900">{product.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{expiryText(product)}</span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800",
        )}
      >
        {tone === "danger" ? "Expired" : "Expiring"}
      </span>
    </Link>
  );
}

/** Dismissible modal shown on the dashboard when products are expired/expiring. */
export function ExpiryAlertDialog() {
  const { data, hasAlerts, dismissed, dismiss, loading } = useExpiryAlert("dashboard");
  const open = !loading && hasAlerts && !dismissed;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Product expiry alert
          </DialogTitle>
          <DialogDescription>
            {data.expired.length > 0 && `${data.expired.length} expired`}
            {data.expired.length > 0 && data.expiringSoon.length > 0 && " · "}
            {data.expiringSoon.length > 0 &&
              `${data.expiringSoon.length} expiring within ${data.warningDays} day${data.warningDays === 1 ? "" : "s"}`}
            . Review these products.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {data.expired.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">Expired</p>
              {data.expired.map((p) => (
                <ProductLine key={p.id} product={p} tone="danger" />
              ))}
            </div>
          )}
          {data.expiringSoon.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Expiring soon</p>
              {data.expiringSoon.map((p) => (
                <ProductLine key={p.id} product={p} tone="warn" />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Dismiss for now
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href="/products?expiring=1">View products</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline banner variant for the inventory/products page. */
export function ExpiryAlertBanner({ className }: { className?: string }) {
  const { data, hasAlerts, dismissed, dismiss, loading } = useExpiryAlert("inventory");
  if (loading || !hasAlerts || dismissed) return null;

  const total = data.expired.length + data.expiringSoon.length;
  const tone = data.expired.length > 0 ? "danger" : "warn";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
        tone === "danger" ? "border-destructive/30 bg-destructive/5" : "border-amber-300 bg-amber-50",
        className,
      )}
    >
      {tone === "danger" ? (
        <PackageX className="size-4 shrink-0 text-destructive" />
      ) : (
        <CalendarClock className="size-4 shrink-0 text-amber-700" />
      )}
      <p className="min-w-0 flex-1 text-xs text-navy-800">
        <span className="font-semibold">
          {data.expired.length > 0 && `${data.expired.length} product(s) expired`}
          {data.expired.length > 0 && data.expiringSoon.length > 0 && " and "}
          {data.expiringSoon.length > 0 &&
            `${data.expiringSoon.length} expiring within ${data.warningDays} day${data.warningDays === 1 ? "" : "s"}`}
        </span>
        {" — check the Expiry column and act before stock is wasted."}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="/products?expiring=1">Review</Link>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Dismiss expiry alert">
          <X className="size-4" />
        </Button>
      </div>
      <span className="sr-only">{total} products need attention</span>
    </div>
  );
}
