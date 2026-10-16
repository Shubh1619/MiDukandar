"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import type { Customer, PaymentMode, Product, SaleDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

type LineProduct = {
  id: string;
  name: string;
  barcode: string | null;
  stock: number;
  sellingPrice: number;
  gstPercent: number;
};

interface LineDraft {
  key: string;
  product: LineProduct | null;
  qty: string;
  unitPrice: string;
  discount: string;
  gst: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** YYYY-MM-DD for a date `days` from today (used as udhaar date defaults). */
function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function newLine(): LineDraft {
  return { key: Math.random().toString(36).slice(2), product: null, qty: "1", unitPrice: "", discount: "0", gst: "" };
}

function lineTotal(line: LineDraft): number {
  const unit = Number(line.unitPrice) || 0;
  const qty = Number(line.qty) || 0;
  const disc = Number(line.discount) || 0;
  const g = Number(line.gst) || 0;
  const taxable = unit * qty - disc;
  return round2(taxable + (g > 0 ? (taxable * g) / 100 : 0));
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editing: SaleDetail | null;
  held?: { id: string; payload: HeldPayload } | null;
}

export type HeldPayload = {
  lines?: {
    productId?: string;
    productName?: string;
    qty?: number;
    unitPrice?: number;
    discount?: number;
    gstPercent?: number;
  }[];
  customerId?: string;
  customer?: { name: string; mobile?: string; address?: string };
  paymentKind?: "paid" | "udhaar";
  payMode?: Exclude<PaymentMode, "CREDIT">;
  discount?: number;
  discountType?: "FLAT" | "PERCENT";
  paidAmount?: number;
  udhaarDueDate?: string;
  udhaarReminderDate?: string;
  notes?: string;
};

export function InvoiceFormDialog({ onClose, onSaved, editing, held }: Props) {
  const { t } = useI18n();
  const hp = held?.payload;
  const [lines, setLines] = useState<LineDraft[]>(() =>
    editing
      ? editing.items.map((it) => ({
          key: Math.random().toString(36).slice(2),
          product: it.productId
            ? {
                id: it.productId,
                name: it.productName,
                barcode: it.barcode,
                stock: 0,
                sellingPrice: Number(it.unitPrice) || 0,
                gstPercent: Number(it.gstPercent) || 0,
              }
            : null,
          qty: String(Number(it.qty) || 0),
          unitPrice: String(Number(it.unitPrice) || 0),
          discount: String(Number(it.discount) || 0),
          gst: String(Number(it.gstPercent) || 0),
        }))
      : hp?.lines && hp.lines.length > 0
        ? hp.lines.map((l) => ({
            key: Math.random().toString(36).slice(2),
            product: l.productId
              ? {
                  id: l.productId,
                  name: l.productName ?? "",
                  barcode: null,
                  stock: 0,
                  sellingPrice: Number(l.unitPrice) || 0,
                  gstPercent: Number(l.gstPercent) || 0,
                }
              : null,
            qty: String(Number(l.qty) || 1),
            unitPrice: String(Number(l.unitPrice) || 0),
            discount: String(Number(l.discount) || 0),
            gst: String(Number(l.gstPercent) || 0),
          }))
        : [newLine()],
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() =>
    editing?.customer
      ? {
          id: editing.customer.id,
          name: editing.customer.name,
          mobile: editing.customer.mobile ?? null,
          address: editing.customer.address ?? null,
          city: null,
          state: null,
          pincode: null,
          creditLimit: 0,
          openingBalance: 0,
          outstanding: 0,
          createdAt: "",
        }
      : hp?.customerId
        ? {
            id: hp.customerId,
            name: hp.customer?.name ?? "",
            mobile: hp.customer?.mobile ?? null,
            address: hp.customer?.address ?? null,
            city: null,
            state: null,
            pincode: null,
            creditLimit: 0,
            openingBalance: 0,
            outstanding: 0,
            createdAt: "",
          }
        : null,
  );
  const [customerName, setCustomerName] = useState(editing?.customer?.name ?? hp?.customer?.name ?? "");
  const [customerMobile, setCustomerMobile] = useState(editing?.customer?.mobile ?? hp?.customer?.mobile ?? "");
  const [customerAddress, setCustomerAddress] = useState(editing?.customer?.address ?? hp?.customer?.address ?? "");
  const [paymentKind, setPaymentKind] = useState<"paid" | "udhaar">(
    hp?.paymentKind ?? (editing?.paymentMode === "CREDIT" ? "udhaar" : "paid"),
  );
  const [payMode, setPayMode] = useState<Exclude<PaymentMode, "CREDIT">>(
    hp?.payMode ?? (editing?.paymentMode && editing.paymentMode !== "CREDIT" ? editing.paymentMode : "CASH"),
  );
  const [udhaarDueDate, setUdhaarDueDate] = useState(hp?.udhaarDueDate ?? "");
  const [udhaarReminderDate, setUdhaarReminderDate] = useState(hp?.udhaarReminderDate ?? "");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">(hp?.discountType ?? editing?.discountType ?? "FLAT");
  const [billDiscount, setBillDiscount] = useState(hp?.discount != null ? String(hp.discount) : editing ? String(Number(editing.discount) || 0) : "0");
  const [paidAmount, setPaidAmount] = useState(hp?.paidAmount != null ? String(hp.paidAmount) : editing ? String(Number(editing.paidAmount) || 0) : "");
  const [notes, setNotes] = useState(hp?.notes ?? editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const paymentMode: PaymentMode = paymentKind === "udhaar" ? "CREDIT" : payMode;

  const applyCustomer = useCallback((c: Customer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerMobile(c.mobile ?? "");
    setCustomerAddress(c.address ?? "");
  }, []);

  const onCustomerNameChange = useCallback((v: string) => {
    if (selectedCustomer && selectedCustomer.name !== v.trim()) setSelectedCustomer(null);
    setCustomerName(v);
  }, [selectedCustomer]);

  const onCustomerMobileChange = useCallback((v: string) => {
    if (selectedCustomer && (selectedCustomer.mobile ?? "") !== v.trim()) setSelectedCustomer(null);
    setCustomerMobile(v);
  }, [selectedCustomer]);

  const updateLine = useCallback((key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }, []);

  const pricing = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      if (!l.product) continue;
      const unit = Number(l.unitPrice) || 0;
      const qty = Number(l.qty) || 0;
      const disc = Number(l.discount) || 0;
      const g = Number(l.gst) || 0;
      const taxable = unit * qty - disc;
      subtotal += unit * qty;
      tax += g > 0 ? (taxable * g) / 100 : 0;
    }
    subtotal = round2(subtotal);
    tax = round2(tax);
    let billDisc = round2(Number(billDiscount) || 0);
    if (discountType === "PERCENT") billDisc = round2(subtotal * (billDisc / 100));
    const total = round2(subtotal + tax - billDisc);
    return { subtotal, tax, billDisc, total, lineCount: lines.filter((l) => l.product).length };
  }, [lines, billDiscount, discountType]);

  const save = async () => {
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (valid.length === 0) {
      toast.error(t("items"));
      return;
    }
    const hasCustomer = Boolean(selectedCustomer) || customerName.trim().length > 0;
    if (paymentKind === "udhaar" && !hasCustomer) {
      toast.error(t("udhaarNeedsCustomer"));
      return;
    }
    setBusy(true);
    try {
      const body = {
        customerId: selectedCustomer?.id,
        customer: hasCustomer && !selectedCustomer
          ? {
              name: customerName.trim(),
              mobile: customerMobile.trim() || undefined,
              address: customerAddress.trim() || undefined,
            }
          : undefined,
        udhaar: paymentKind === "udhaar"
          ? {
              dueDate: udhaarDueDate || todayPlus(7),
              reminderDate: udhaarReminderDate || todayPlus(5),
            }
          : undefined,
        lines: valid.map((l) => ({
          productId: l.product!.id,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
          gstPercent: Number(l.gst) || undefined,
        })),
        paymentMode,
        discount: Number(billDiscount) || 0,
        discountType,
        ...(paymentKind === "udhaar" ? { paidAmount: Number(paidAmount) || 0 } : {}),
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await apiFetch(`/api/sales/${editing.id}`, { method: "PUT", body });
      } else {
        await apiFetch(`/api/sales`, { method: "POST", body });
      }
      if (held) {
        try {
          await apiFetch(`/api/sales/held/${held.id}`, { method: "DELETE" });
        } catch {
          // held bill already gone; ignore
        }
      }
      toast.success(t("success"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const hold = async () => {
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (valid.length === 0) {
      toast.error(t("items"));
      return;
    }
    setBusy(true);
    try {
      const payload: HeldPayload = {
        lines: valid.map((l) => ({
          productId: l.product!.id,
          productName: l.product!.name,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
          gstPercent: Number(l.gst) || undefined,
        })),
        customerId: selectedCustomer?.id,
        customer: customerName.trim()
          ? { name: customerName.trim(), mobile: customerMobile.trim() || undefined, address: customerAddress.trim() || undefined }
          : undefined,
        paymentKind,
        payMode,
        discount: Number(billDiscount) || 0,
        discountType,
        paidAmount: Number(paidAmount) || 0,
        udhaarDueDate: udhaarDueDate || undefined,
        udhaarReminderDate: udhaarReminderDate || undefined,
        notes: notes.trim() || undefined,
      };
      await apiFetch(`/api/sales/hold`, { method: "POST", body: { label: customerName.trim() || undefined, payload } });
      toast.success(t("heldBillSaved"));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog defaultOpen onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] w-[96vw] !max-w-none sm:!w-[92vw] sm:!max-w-3xl lg:!max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editInvoice") : t("newInvoice")}</DialogTitle>
          <DialogDescription>
            {editing ? editing.invoiceNumber : t("createFirstInvoice")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <Label>{t("customer")}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <CustomerLookup
                value={customerName}
                onChange={onCustomerNameChange}
                onPick={applyCustomer}
                placeholder={t("customerName")}
              />
              <CustomerLookup
                value={customerMobile}
                onChange={onCustomerMobileChange}
                onPick={applyCustomer}
                placeholder={t("mobileNumber")}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {selectedCustomer ? `${t("usingExistingCustomer")}` : t("newCustomerHint")}
            </p>
            {!selectedCustomer && (
              <Input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder={t("address")}
              />
            )}
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
                        {line.product.stock > 0 ? `${t("inStock")} ${line.product.stock} · ` : ""}
                        {formatINR(line.product.sellingPrice)}
                        {line.product.barcode ? ` · ${line.product.barcode}` : ""}
                      </p>
                    </div>
                  ) : (
                    <ProductSearch
                      onSelect={(p) =>
                        updateLine(line.key, {
                          product: p,
                          unitPrice: String(p.sellingPrice || ""),
                          gst: String(p.gstPercent ?? 0),
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
                    <div className="grid grid-cols-4 gap-2">
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("qty")}</span>
                        <Input type="number" min={0} step="any" value={line.qty} onChange={(e) => updateLine(line.key, { qty: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("unitPrice")}</span>
                        <Input type="number" min={0} step="any" value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("discount")}</span>
                        <Input type="number" min={0} step="any" value={line.discount} onChange={(e) => updateLine(line.key, { discount: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("gstPercent")}</span>
                        <Input type="number" min={0} step="any" value={line.gst} onChange={(e) => updateLine(line.key, { gst: e.target.value })} />
                      </label>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {formatINR(lineTotal(line))}
                    </p>
                  </>
                )}
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine()])}>
              <Plus className="size-4" /> {t("addItem")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("discount")}</Label>
              <div className="flex gap-1.5">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as "FLAT" | "PERCENT")}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">₹</SelectItem>
                    <SelectItem value="PERCENT">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min={0} step="any" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentType")}</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setPaymentKind("paid")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    paymentKind === "paid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("paid")}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentKind("udhaar")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    paymentKind === "udhaar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("udhaar")}
                </button>
              </div>
            </div>
          </div>

          {paymentKind === "paid" && (
            <div className="space-y-1.5">
              <Label>{t("paymentMode")}</Label>
              <Select value={payMode} onValueChange={(v) => setPayMode(v as Exclude<PaymentMode, "CREDIT">)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["CASH", "UPI", "CARD"] as const).map((m) => (
                    <SelectItem key={m} value={m}>{t(m.toLowerCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {paymentKind === "udhaar" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("expectedPayDate")}</Label>
                  <Input type="date" value={udhaarDueDate} onChange={(e) => setUdhaarDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("reminderDate")}</Label>
                  <Input type="date" value={udhaarReminderDate} onChange={(e) => setUdhaarReminderDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("paidNow")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className={cn("ml-auto w-full max-w-xs space-y-1 text-sm", "sm:w-64")}>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("subtotal")}</span>
              <span className="tabular-nums">{formatINR(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("discount")}</span>
              <span className="tabular-nums">−{formatINR(pricing.billDisc)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("tax")}</span>
              <span className="tabular-nums">{formatINR(pricing.tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-display text-lg font-bold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{formatINR(pricing.total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          {!editing && (
            <Button variant="outline" onClick={hold} disabled={busy || pricing.lineCount === 0}>
              {t("holdBill")}
            </Button>
          )}
          <Button onClick={() => void save()} disabled={busy || pricing.lineCount === 0} className="min-w-32">
            {busy ? <Loader2 className="size-4 animate-spin" /> : editing ? t("updateInvoice") : t("newInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Search pickers (debounced async lists)
// ---------------------------------------------------------------------------

function ProductSearch({ onSelect }: { onSelect: (p: LineProduct) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LineProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<{ products: Product[] }>(
        `/api/products?search=${encodeURIComponent(term.trim())}&limit=20`,
      );
      setOptions(
        data.products.map((p) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          stock: Number(p.stock ?? 0),
          sellingPrice: Number(p.sellingPrice) || 0,
          gstPercent: Number(p.gstPercent) || 0,
        })),
      );
      setOpen(true);
    } catch {
      setOptions([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(query), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, search]);

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("selectProduct")}
        className="pr-8"
      />
      {busy && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && options.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {options.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseUp={() => {
                onSelect(p);
                setQuery(p.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="min-w-0 truncate">{p.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {p.stock > 0 ? `${t("inStock")}: ${p.stock}` : t("outOfStock")} · {formatINR(p.sellingPrice)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerLookup({
  value,
  onChange,
  onPick,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: Customer) => void;
  placeholder: string;
}) {
  const [options, setOptions] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<{ customers: Customer[] }>(
        `/api/customers?search=${encodeURIComponent(term.trim())}&limit=20`,
      );
      setOptions(data.customers);
      setOpen(true);
    } catch {
      setOptions([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(value), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, search]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="pr-8"
      />
      {busy && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && options.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md ring-1 ring-foreground/10">
          {options.slice(0, 8).map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseUp={() => {
                onPick(c);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="min-w-0 truncate">{c.name}</span>
              {c.mobile && <span className="shrink-0 text-[11px] text-muted-foreground">{c.mobile}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}