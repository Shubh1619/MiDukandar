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

const gridInput =
  "h-9 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
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
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="size-4" /> {t("addItem")}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground">
                  {[
                    t("challanProduct"),
                    t("unit"),
                    t("challanBatch"),
                    t("challanExpiry"),
                    t("qty"),
                    t("challanTab"),
                    t("challanFree"),
                    t("rate"),
                    t("mrp"),
                    t("challanDis1"),
                    t("amount"),
                  ].map((label, i) => (
                    <th
                      key={label}
                      className={`border-b border-r px-2 py-2 text-[10px] font-semibold uppercase tracking-wide ${i >= 4 ? "text-right" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                  <th className="w-9 border-b" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const money = line.product
                    ? challanLine({
                        quantity: Number(line.qty) || 0,
                        rate: Number(line.rate) || 0,
                        discountPercent: Number(line.discountPct) || 0,
                        taxRate: Number(line.taxRate) || 0,
                      })
                    : null;
                  return (
                    <tr key={line.key} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="min-w-[200px] border-r p-0">
                        {line.product ? (
                          <button
                            type="button"
                            className="h-9 w-full truncate px-2 text-left text-sm font-medium"
                            title={line.stock != null ? `${line.product.name} · ${t("inStock")} ${line.stock}` : line.product.name}
                            onClick={() => updateLine(line.key, { product: null })}
                          >
                            {line.product.name}
                          </button>
                        ) : (
                          <ProductSearch
                            inputClassName={`${gridInput} pr-7`}
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
                      </td>
                      <td className="w-20 border-r p-0">
                        <Input value={line.pack} onChange={(e) => updateLine(line.key, { pack: e.target.value })} className={gridInput} />
                      </td>
                      <td className="w-24 border-r p-0">
                        <Input value={line.batch} onChange={(e) => updateLine(line.key, { batch: e.target.value })} className={gridInput} />
                      </td>
                      <td className="w-36 border-r p-0">
                        <Input type="date" value={line.expiry} onChange={(e) => updateLine(line.key, { expiry: e.target.value })} className={gridInput} />
                      </td>
                      <td className="w-16 border-r p-0">
                        <NumberInput value={line.qty} onChange={(v) => updateLine(line.key, { qty: v })} decimals={3} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-16 border-r p-0">
                        <NumberInput value={line.tab} onChange={(v) => updateLine(line.key, { tab: v })} decimals={3} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-20 border-r p-0">
                        <NumberInput value={line.free} onChange={(v) => updateLine(line.key, { free: v })} decimals={3} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-24 border-r p-0">
                        <NumberInput value={line.rate} onChange={(v) => updateLine(line.key, { rate: v })} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-24 border-r p-0">
                        <NumberInput value={line.mrp} onChange={(v) => updateLine(line.key, { mrp: v })} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-20 border-r p-0">
                        <NumberInput value={line.discountPct} onChange={(v) => updateLine(line.key, { discountPct: v })} max={100} className={`${gridInput} text-right`} />
                      </td>
                      <td className="w-24 border-r px-2 text-right text-sm font-medium tabular-nums">
                        {money && Number(line.qty) > 0 ? formatINR(money.taxable) : "—"}
                      </td>
                      <td className="w-9 p-0 text-center">
                        <button
                          type="button"
                          className="inline-flex size-9 items-center justify-center text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(line.key)}
                          aria-label={t("delete")}
                        >
                          <X className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
