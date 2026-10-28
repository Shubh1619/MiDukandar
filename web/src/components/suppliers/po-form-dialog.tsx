"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import type { Product, PurchaseOrderDetail, Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductSearch } from "./product-search";
import { challanLine, challanTotals } from "./challan";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LineDraft {
  key: string;
  product: Product | null;
  pack: string;
  batch: string;
  qty: string;
  tab: string;
  free: string;
  rate: string;
  mrp: string;
  discountPct: string;
  taxRate: string;
  expiry: string;
  stock: number | null;
}

function newLine(): LineDraft {
  return {
    key: Math.random().toString(36).slice(2),
    product: null,
    pack: "",
    batch: "",
    qty: "",
    tab: "",
    free: "",
    rate: "",
    mrp: "",
    discountPct: "",
    taxRate: "",
    expiry: "",
    stock: null,
  };
}

const START_ROWS = 3;

function startingLines(): LineDraft[] {
  return Array.from({ length: START_ROWS }, () => newLine());
}

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  const [lines, setLines] = useState<LineDraft[]>(startingLines);
  const [orderDate, setOrderDate] = useState(today());
  const [partyNumber, setPartyNumber] = useState("");
  const [partyDate, setPartyDate] = useState("");
  const [challanType, setChallanType] = useState<"CASH" | "CREDIT">("CASH");
  const [status, setStatus] = useState<"draft" | "sent">("draft");
  const [chosenSupplierId, setChosenSupplierId] = useState(supplierId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busy, setBusy] = useState(false);

  const lockedSupplier = Boolean(supplierId);

  const seed = () => {
    setChosenSupplierId(supplierId);
    if (editing) {
      const seeded = editing.items.map((it) => ({
        key: Math.random().toString(36).slice(2),
        product: {
          id: it.productId,
          name: it.name ?? "",
          barcode: null,
          sku: null,
          category: null,
          unit: it.pack ?? "",
          purchasePrice: Number(it.rate),
          sellingPrice: Number(it.rate) || 0,
          mrp: it.mrp != null ? Number(it.mrp) : null,
          gstPercent: Number(it.taxRate),
          minStock: 0,
          supplier: null,
          imageUrl: null,
          isArchived: false,
          stock: 0,
          isLow: false,
          createdAt: "",
        } satisfies Product,
        pack: it.pack ?? "",
        batch: it.batch ?? "",
        qty: String(Number(it.quantity) || ""),
        tab: it.tabQty != null && Number(it.tabQty) !== 0 ? String(Number(it.tabQty)) : "",
        free: it.freeQty != null && Number(it.freeQty) !== 0 ? String(Number(it.freeQty)) : "",
        rate: String(Number(it.rate) || ""),
        mrp: it.mrp != null && Number(it.mrp) !== 0 ? String(Number(it.mrp)) : "",
        discountPct: it.discountPercent != null && Number(it.discountPercent) !== 0 ? String(Number(it.discountPercent)) : "",
        taxRate: String(Number(it.taxRate) || ""),
        expiry: it.expiryDate?.slice(0, 10) ?? "",
        stock: null,
      }));
      setLines(seeded.length ? seeded : startingLines());
      setOrderDate(editing.orderDate?.slice(0, 10) || today());
      setPartyNumber(editing.partyNumber ?? "");
      setPartyDate(editing.partyDate?.slice(0, 10) ?? "");
      setChallanType(editing.challanType === "CREDIT" ? "CREDIT" : "CASH");
      setStatus(editing.status === "sent" ? "sent" : "draft");
    } else {
      setLines(startingLines());
      setOrderDate(today());
      setPartyNumber("");
      setPartyDate("");
      setChallanType("CASH");
      setStatus("draft");
    }
  };

  const loadSuppliers = async () => {
    if (supplierId) return;
    try {
      const data = await apiFetch<{ suppliers: Supplier[] }>("/api/suppliers?limit=200");
      setSuppliers(data.suppliers ?? []);
    } catch {
      setSuppliers([]);
    }
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const removeLine = (key: string) =>
    setLines((prev) => {
      const remaining = prev.filter((l) => l.key !== key);
      return remaining.length ? remaining : [newLine()];
    });

  const pricing = useMemo(() => {
    const priced = lines
      .filter((l) => l.product && Number(l.qty) > 0)
      .map((l) =>
        challanLine({
          quantity: Number(l.qty) || 0,
          rate: Number(l.rate) || 0,
          discountPercent: Number(l.discountPct) || 0,
          taxRate: Number(l.taxRate) || 0,
        }),
      );
    return { ...challanTotals(priced), lineCount: priced.length };
  }, [lines]);

  const supplierLabel =
    supplierName || suppliers.find((s) => s.id === chosenSupplierId)?.name || "";

  const save = async () => {
    const sid = supplierId || chosenSupplierId;
    if (!sid) {
      toast.error(t("challanSupplierRequired"));
      return;
    }
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (valid.length === 0) {
      toast.error(t("productRequired"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        supplierId: sid,
        orderDate,
        partyNumber: partyNumber.trim(),
        partyDate: partyDate || null,
        challanType,
        status,
        lines: valid.map((l) => ({
          productId: l.product!.id,
          quantity: Number(l.qty),
          rate: Number(l.rate) || 0,
          mrp: Number(l.mrp) || 0,
          taxRate: Number(l.taxRate) || 0,
          pack: l.pack.trim(),
          batch: l.batch.trim(),
          expiryDate: l.expiry || undefined,
          tabQty: Number(l.tab) || 0,
          freeQty: Number(l.free) || 0,
          discountPercent: Number(l.discountPct) || 0,
        })),
      };
      if (editing) {
        await apiFetch(`/api/purchase-orders/${editing.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/purchase-orders", { method: "POST", body });
      }
      toast.success(t("success"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          seed();
          void loadSuppliers();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editPo") : t("newPo")}</DialogTitle>
          <DialogDescription>{supplierLabel || t("challanSupplierRequired")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t("supplier")}</Label>
            {lockedSupplier ? (
              <p className="flex h-8 items-center truncate rounded-lg border bg-muted/40 px-2.5 text-sm font-medium">{supplierLabel}</p>
            ) : (
              <select value={chosenSupplierId} onChange={(e) => setChosenSupplierId(e.target.value)} className={selectClass}>
                <option value="">{t("challanSupplierRequired")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("orderDate")}</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("poNumber")}</Label>
            <p className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm tabular-nums">{editing?.poNumber || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("paymentMode")}</Label>
            <select
              value={challanType}
              onChange={(e) => setChallanType(e.target.value as "CASH" | "CREDIT")}
              className={selectClass}
            >
              <option value="CASH">{t("cash")}</option>
              <option value="CREDIT">{t("credit")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("challanPartyNo")}</Label>
            <Input value={partyNumber} onChange={(e) => setPartyNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("challanDt")}</Label>
            <Input type="date" value={partyDate} onChange={(e) => setPartyDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("items")}</Label>
            <span className="text-xs text-muted-foreground">{lines.length}</span>
          </div>
          {lines.map((line, index) => {
            const money = line.product
              ? challanLine({
                  quantity: Number(line.qty) || 0,
                  rate: Number(line.rate) || 0,
                  discountPercent: Number(line.discountPct) || 0,
                  taxRate: Number(line.taxRate) || 0,
                })
              : null;
            return (
              <div key={line.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-xs font-medium text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    {line.product ? (
                      <div>
                        <p className="truncate text-sm font-medium">{line.product.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {line.stock != null ? `${t("inStock")} ${line.stock}` : t("challanProduct")}
                        </p>
                      </div>
                    ) : (
                      <ProductSearch
                        onSelect={(p) =>
                          updateLine(line.key, {
                            product: p,
                            pack: p.unit || "",
                            rate: p.purchasePrice != null ? String(p.purchasePrice) : "",
                            mrp: p.mrp != null ? String(p.mrp) : "",
                            taxRate: String(p.gstPercent ?? 0),
                            expiry: p.expiryDate?.slice(0, 10) ?? "",
                            stock: p.stock,
                            qty: line.qty || "1",
                          })
                        }
                      />
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.key)} aria-label={t("delete")}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("unit")}</span>
                    <Input value={line.pack} onChange={(e) => updateLine(line.key, { pack: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("challanBatch")}</span>
                    <Input value={line.batch} onChange={(e) => updateLine(line.key, { batch: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("challanExpiry")}</span>
                    <Input type="date" value={line.expiry} onChange={(e) => updateLine(line.key, { expiry: e.target.value })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("qty")}</span>
                    <NumberInput value={line.qty} onChange={(v) => updateLine(line.key, { qty: v })} decimals={3} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("challanTab")}</span>
                    <NumberInput value={line.tab} onChange={(v) => updateLine(line.key, { tab: v })} decimals={3} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("challanFree")}</span>
                    <NumberInput value={line.free} onChange={(v) => updateLine(line.key, { free: v })} decimals={3} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("rate")}</span>
                    <NumberInput value={line.rate} onChange={(v) => updateLine(line.key, { rate: v })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("mrp")}</span>
                    <NumberInput value={line.mrp} onChange={(v) => updateLine(line.key, { mrp: v })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("challanDis1")}</span>
                    <NumberInput value={line.discountPct} onChange={(v) => updateLine(line.key, { discountPct: v })} max={100} />
                  </label>
                  <div className="space-y-1 sm:col-span-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("amount")}</span>
                    <p className="flex h-8 items-center justify-end text-sm font-semibold tabular-nums">
                      {money && Number(line.qty) > 0 ? formatINR(money.taxable) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-4" /> {t("addItem")}
          </Button>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span className="tabular-nums">{formatINR(pricing.goods)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("discount")}</span>
            <span className="tabular-nums">{formatINR(pricing.discount)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t("challanGst")}</span>
            <span className="tabular-nums">{formatINR(pricing.gst)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t pt-1 font-display text-lg font-bold">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatINR(pricing.net)}</span>
          </div>
        </div>

        <DialogFooter>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "sent")}
            className={`${selectClass} sm:w-36`}
            aria-label={t("status")}
          >
            <option value="draft">{t("statusDraft")}</option>
            <option value="sent">{t("statusSent")}</option>
          </select>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("cancel")}</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || pricing.lineCount === 0} className="min-w-28">
            {busy ? <Loader2 className="size-4 animate-spin" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
