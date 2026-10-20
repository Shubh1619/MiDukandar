"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import type { Product, PurchaseOrderDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductSearch } from "./product-search";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LineDraft {
  key: string;
  product: Product | null;
  qty: string;
  rate: string;
  taxRate: string;
}

function newLine(): LineDraft {
  return { key: Math.random().toString(36).slice(2), product: null, qty: "1", rate: "", taxRate: "" };
}

function lineTotal(l: LineDraft): number {
  const qty = Number(l.qty) || 0;
  const rate = Number(l.rate) || 0;
  const tax = Number(l.taxRate) || 0;
  return round2(qty * rate + (qty * rate * tax) / 100);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId?: string;
  supplierName?: string;
  editing: PurchaseOrderDetail | null;
  onSaved: () => void;
}

export function PurchaseOrderFormDialog({ open, onOpenChange, supplierId = "", supplierName = "", editing, onSaved }: Props) {
  const { t } = useI18n();
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState<"draft" | "sent">("draft");
  const [busy, setBusy] = useState(false);

  const seed = () => {
    if (editing) {
      setLines(
        editing.items.map((it) => ({
          key: Math.random().toString(36).slice(2),
          product: {
            id: it.productId,
            name: it.name ?? "",
            barcode: null,
            sku: null,
            category: null,
            unit: "",
            purchasePrice: Number(it.rate),
            sellingPrice: Number(it.rate) || 0,
            mrp: null,
            gstPercent: Number(it.taxRate),
            minStock: 0,
            supplier: null,
            imageUrl: null,
            isArchived: false,
            stock: 0,
            isLow: false,
            createdAt: "",
          },
          qty: String(Number(it.quantity) || 1),
          rate: String(Number(it.rate) || ""),
          taxRate: String(Number(it.taxRate) || ""),
        })),
      );
      setOrderDate(editing.orderDate?.slice(0, 10) || today());
      setExpectedDate(editing.expectedDate?.slice(0, 10) || "");
      setStatus(editing.status === "sent" ? "sent" : "draft");
    } else {
      setLines([newLine()]);
      setOrderDate(today());
      setExpectedDate("");
      setStatus("draft");
    }
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((p) => [...p, newLine()]);

  const removeLine = (key: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p));

  const pricing = useMemo(() => {
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    const total = round2(valid.reduce((acc, l) => acc + lineTotal(l), 0));
    return { total, lineCount: valid.length };
  }, [lines]);

  const save = async () => {
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (valid.length === 0) {
      toast.error(t("productRequired"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        supplierId,
        orderDate,
        expectedDate: expectedDate || undefined,
        status,
        lines: valid.map((l) => ({
          productId: l.product!.id,
          quantity: Number(l.qty),
          rate: Number(l.rate) || 0,
          taxRate: Number(l.taxRate) || 0,
        })),
      };
      if (editing) {
        await apiFetch(`/api/purchase-orders/${editing.id}`, { method: "PATCH", body });
        toast.success(t("success"));
      } else {
        await apiFetch("/api/purchase-orders", { method: "POST", body });
        toast.success(t("success"));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) seed(); onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editPo") : t("newPo")}</DialogTitle>
          <DialogDescription>{supplierName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("poDate")}</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("expectedDate")}</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "sent")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("statusDraft")}</SelectItem>
                  <SelectItem value="sent">{t("statusSent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("items")}</Label>
            {lines.map((line) => (
              <div key={line.key} className="space-y-2 rounded-lg border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  {line.product ? (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatINR(line.product.purchasePrice)}
                        {line.product.barcode ? ` · ${line.product.barcode}` : ""}
                      </p>
                    </div>
                  ) : (
                    <ProductSearch
                      onSelect={(p) =>
                        updateLine(line.key, {
                          product: p,
                          rate: String(p.purchasePrice || ""),
                          taxRate: String(p.gstPercent ?? 0),
                        })
                      }
                    />
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.key)} aria-label={t("delete")}>
                    <X className="size-4" />
                  </Button>
                </div>

                {line.product && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("qty")}</span>
                        <Input type="number" min={0} step="any" value={line.qty} onChange={(e) => updateLine(line.key, { qty: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("rate")}</span>
                        <Input type="number" min={0} step="any" value={line.rate} onChange={(e) => updateLine(line.key, { rate: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("gstPercent")}</span>
                        <Input type="number" min={0} step="any" value={line.taxRate} onChange={(e) => updateLine(line.key, { taxRate: e.target.value })} />
                      </label>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">{formatINR(lineTotal(line))}</p>
                  </>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="size-4" /> {t("addItem")}
            </Button>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm sm:w-64">
            <div className="flex justify-between border-t pt-1 font-display text-lg font-bold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{formatINR(pricing.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={() => void save()} disabled={busy || pricing.lineCount === 0} className="min-w-32">
            {busy ? <Loader2 className="size-4 animate-spin" /> : editing ? t("updatePo") : t("newPo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}