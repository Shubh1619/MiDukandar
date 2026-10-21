"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Eye } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatQty, formatDateTime } from "@/lib/format";
import { PAYMENT_STATUS_BADGE } from "@/lib/badges";
import type { Purchase, PurchaseDetail, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSearch } from "@/components/shared/table-search";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { PendingButton } from "@/components/shared/pending-button";

interface LineDraft {
  productId: string;
  name: string;
  qty: string;
  unitPrice: string;
}

export default function PurchasesPage() {
  const { t } = useI18n();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const [paying, setPaying] = useState<Purchase | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payingSave, setPayingSave] = useState(false);

  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("supplier", search.trim());
      const data = await apiFetch<{ purchases: Purchase[]; total: number }>(`/api/purchases?${params}`);
      setPurchases(data.purchases);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = async () => {
    setDialogOpen(true);
    setSupplier("");
    setNotes("");
    setLines([]);
    try {
      const data = await apiFetch<{ products: Product[] }>("/api/products?limit=200");
      setProducts(data.products);
    } catch {
      setProducts([]);
    }
  };

  const addLine = () => {
    const first = products[0];
    if (!first) return;
    setLines((prev) => [...prev, { productId: first.id, name: first.name, qty: "1", unitPrice: String(first.purchasePrice ?? "") }]);
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const createPurchase = async () => {
    const validLines = lines.filter((l) => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0 || !supplier.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/purchases", {
        method: "POST",
        body: {
          supplierName: supplier.trim(),
          lines: validLines.map((l) => ({
            productId: l.productId,
            qty: Number(l.qty),
            unitPrice: Number(l.unitPrice) || 0,
          })),
          notes: notes || undefined,
        },
      });
      toast.success("Purchase recorded - stock updated");
      setDialogOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create purchase");
    } finally {
      setSaving(false);
    }
  };

  const applyPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || !paying) return;
    setPayingSave(true);
    try {
      await apiFetch(`/api/purchases/${paying.id}/payment`, {
        method: "POST",
        body: { amount, mode: "CASH" },
      });
      toast.success(`Payment of ${formatINR(amount)} recorded`);
      setPaying(null);
      setPayAmount("");
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setPayingSave(false);
    }
  };

  const viewDetail = async (id: string) => {
    try {
      const data = await apiFetch<{ purchase: PurchaseDetail }>(`/api/purchases/${id}`);
      setDetail(data.purchase);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load detail");
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("navPurchases")}</h1>
          <p className="text-xs text-muted-foreground">{total} purchase(s)</p>
        </div>
        <Button onClick={() => void openAdd()}>
          <Plus className="size-4" /> {t("addPurchase")}
        </Button>
      </div>

      <TableSearch value={search} onChange={(v) => { setSearch(v); setPage(1); }} />

      <div className="rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : purchases.length === 0 ? (
          <EmptyState message={t("noData")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("purchaseNumber")}</TableHead>
                <TableHead>{t("supplierName")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.purchaseNumber}</TableCell>
                  <TableCell>{p.supplierName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(p.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(p.dueAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PAYMENT_STATUS_BADGE[p.paymentStatus] ?? ""}>{p.paymentStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => void viewDetail(p.id)} aria-label={t("edit")}>
                        <Eye className="size-4" />
                      </Button>
                      {Number(p.dueAmount) > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => { setPaying(p); setPayAmount(String(p.dueAmount)); }} aria-label="Pay">
                          <Wallet className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pager
        page={page}
        pages={pages}
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("addPurchase")}</DialogTitle>
            <DialogDescription>Stock is added automatically when you save.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("supplierName")} *</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Ashok Distributors" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("items")} *</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="size-3.5" /> Add line
                </Button>
              </div>
              {lines.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No items yet</p>}
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_70px_90px_32px] items-center gap-2">
                  <select
                    value={line.productId}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value);
                      updateLine(index, { productId: e.target.value, name: p?.name ?? "", unitPrice: p ? String(p.purchasePrice ?? "") : line.unitPrice });
                    }}
                    className="h-9 rounded-lg border bg-background px-2 text-sm outline-none focus:border-ring"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <NumberInput value={line.qty} onChange={(v) => updateLine(index, { qty: v })} placeholder="Qty" />
                  <NumberInput value={line.unitPrice} onChange={(v) => updateLine(index, { unitPrice: v })} placeholder="Price" />
                  <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void createPurchase()} busy={saving} disabled={lines.length === 0 || !supplier.trim()}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment to supplier</DialogTitle>
            <DialogDescription>{paying?.purchaseNumber} - due {paying ? formatINR(paying.dueAmount) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("amount")}</Label>
            <NumberInput value={payAmount} onChange={(v) => setPayAmount(v)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void applyPayment()} busy={payingSave}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.purchaseNumber}</DialogTitle>
            <DialogDescription>
              {detail?.supplierName} · {detail ? formatDateTime(detail.createdAt) : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-1.5 font-medium">Product</th>
                      <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{it.productName}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatQty(it.qty)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto w-44 space-y-0.5 text-xs">
                <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}</span><span className="tabular-nums">{formatINR(detail.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t("tax")}</span><span className="tabular-nums">{formatINR(detail.taxTotal)}</span></div>
                <div className="flex justify-between font-display text-base font-bold"><span>{t("total")}</span><span className="tabular-nums">{formatINR(detail.total)}</span></div>
                <div className="flex justify-between font-medium text-emerald-700"><span>Paid</span><span className="tabular-nums">{formatINR(detail.paidAmount)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}