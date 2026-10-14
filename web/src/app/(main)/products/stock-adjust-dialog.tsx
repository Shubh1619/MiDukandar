"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatQty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  product: Product | null;
  setProduct: (p: Product | null) => void;
  onChanged: (productId: string, balanceAfter: number) => void;
}

export default function StockAdjustDialog({ product, setProduct, onChanged }: Props) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Manual adjustment");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    const n = Number(qty);
    if (!n || !product) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ balanceAfter: number }>(`/api/products/${product.id}/adjust`, {
        method: "POST",
        body: { qty: n, reason: reason.trim() ? reason.trim() : "Manual adjustment" },
      });
      toast.success(`Stock adjusted to ${formatQty(res.balanceAfter)}`);
      setProduct(null);
      setQty("");
      setReason("Manual adjustment");
      onChanged(product.id, res.balanceAfter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Adjustment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) { setProduct(null); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" /> Adjust stock
          </DialogTitle>
          <DialogDescription>
            {product?.name} — currently {product ? formatQty(product.stock) : ""} in stock.
            Use a negative number to remove stock and a positive number to add.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Quantity change</Label>
            <Input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. -5 to remove, +10 to add"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, counted, restocked" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setProduct(null)}>Cancel</Button>
          <Button onClick={() => void apply()} disabled={saving || !qty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Adjusting…" : "Adjust stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}