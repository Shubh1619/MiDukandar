"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Product, ProductSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export interface ProductFormState {
  name: string;
  barcode: string;
  sku: string;
  category: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  mrp: string;
  gstPercent: string;
  minStock: string;
  supplier: string;
  description: string;
  openingStock: string;
}

export const EMPTY_FORM: ProductFormState = {
  name: "",
  barcode: "",
  sku: "",
  category: "",
  unit: "pc",
  purchasePrice: "",
  sellingPrice: "",
  mrp: "",
  gstPercent: "",
  minStock: "0",
  supplier: "",
  description: "",
  openingStock: "0",
};

export function formFromProduct(p: Product): ProductFormState {
  return {
    name: p.name,
    barcode: p.barcode ?? "",
    sku: p.sku ?? "",
    category: p.category ?? "",
    unit: p.unit,
    purchasePrice: String(p.purchasePrice),
    sellingPrice: String(p.sellingPrice),
    mrp: p.mrp != null ? String(p.mrp) : "",
    gstPercent: String(p.gstPercent),
    minStock: String(p.minStock),
    supplier: p.supplier ?? "",
    description: p.description ?? "",
    openingStock: "0",
  };
}

const UNITS = ["pc", "kg", "l", "box", "pack", "dozen", "g"];
const GST_LEVELS = ["0", "5", "12", "18", "28"];

export interface ProductSavedPayload {
  product: Product;
  summary: ProductSummary | null;
}

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
  editing: Product | null;
  onSaved: (payload: ProductSavedPayload) => void;
  onDuplicate: (existingId: string) => void;
}

export default function ProductFormDialog({ open, setOpen, editing, onSaved, onDuplicate }: Props) {
  const [form, setForm] = useState<ProductFormState>(() =>
    editing ? formFromProduct(editing) : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      sku: form.sku.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      mrp: form.mrp.trim() !== "" ? Number(form.mrp) : undefined,
      gstPercent: Number(form.gstPercent) || 0,
      minStock: Number(form.minStock) || 0,
      supplier: form.supplier.trim() || undefined,
      description: form.description.trim() || undefined,
      openingStock: editing ? undefined : Number(form.openingStock) || 0,
    };
    try {
      if (editing) {
        const res = await apiFetch<{ product: Product; summary: ProductSummary }>(`/api/products/${editing.id}`, { method: "PUT", body });
        toast.success("Product updated");
        setOpen(false);
        onSaved({ product: res.product, summary: res.summary });
      } else {
        const res = await apiFetch<{ product: Product; summary: ProductSummary }>("/api/products", { method: "POST", body });
        toast.success("Product added");
        setOpen(false);
        onSaved({ product: res.product, summary: res.summary });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "PRODUCT_EXISTS" && err.details) {
        const existing = (err.details as { existing?: { id?: string } }).existing;
        toast.warning("A product with this name / SKU / barcode already exists.");
        setForm((f) => ({ ...f, name: form.name })); // keep typed values
        setError(err.message);
        if (existing?.id) onDuplicate(existing.id);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to save product");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update product details. Duplicates by name, SKU or barcode are blocked."
              : "Add a new product to your catalog. Name, SKU or barcode must be unique."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Stainless Steel Kadai" />
          </div>
          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="e.g. 8901063105991" />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. KADAI-20" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Kitchen" />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Purchase price (₹)</Label>
            <Input type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Selling price (₹) *</Label>
            <Input type="number" min={0} step="0.01" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>MRP (₹)</Label>
            <Input type="number" min={0} step="0.01" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <div className="flex gap-1.5">
              <Input
                type="number" min={0} max={100} step="0.01"
                value={form.gstPercent} onChange={(e) => set("gstPercent", e.target.value)}
                placeholder="0" className="flex-1"
              />
              <div className="flex gap-1">
                {GST_LEVELS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("gstPercent", g)}
                    className={`rounded-md border px-1.5 py-1 text-xs transition-colors ${
                      form.gstPercent === g
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {g}%
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Low stock warning at</Label>
            <Input type="number" min={0} step="0.01" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Optional" />
          </div>
          {!editing && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Opening stock</Label>
              <Input type="number" min={0} step="0.01" value={form.openingStock} onChange={(e) => set("openingStock", e.target.value)} placeholder="0" />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional notes about this product" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}