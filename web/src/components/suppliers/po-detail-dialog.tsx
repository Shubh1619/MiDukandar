"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import { challanLine, challanTotals, formatChallanDate } from "./challan";
import type { PurchaseOrderDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PoStatusBadge } from "./po-status-badge";
import { PurchaseOrderFormDialog } from "./po-form-dialog";
import { PendingButton } from "@/components/shared/pending-button";

function ChallanView({ po }: { po: PurchaseOrderDetail }) {
  const { t } = useI18n();
  const money = po.items.map((it) =>
    challanLine({
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      discountPercent: Number(it.discountPercent) || 0,
      taxRate: Number(it.taxRate) || 0,
    }),
  );
  const totals = challanTotals(money);
  const heads = [
    t("challanProduct"),
    t("challanPack"),
    t("challanBatch"),
    t("challanStrip"),
    t("challanTab"),
    t("challanFree"),
    t("challanPRate"),
    t("challanDis1"),
    t("challanAmount"),
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">{t("supplier")}</span><p className="font-medium">{po.supplierName}</p></div>
        <div><span className="text-muted-foreground">{t("orderDate")}</span><p className="tabular-nums">{formatChallanDate(po.orderDate)}</p></div>
        <div><span className="text-muted-foreground">{t("poNumber")}</span><p className="tabular-nums">{po.poNumber}</p></div>
        <div><span className="text-muted-foreground">{t("paymentMode")}</span><p>{po.challanType === "CREDIT" ? t("credit") : t("cash")}</p></div>
        <div><span className="text-muted-foreground">{t("challanPartyNo")}</span><p>{po.partyNumber || "—"}</p></div>
        <div><span className="text-muted-foreground">{t("challanDt")}</span><p>{po.partyDate ? formatChallanDate(po.partyDate) : "—"}</p></div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              {heads.map((label, i) => (
                <th key={label} className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wide ${i >= 3 ? "text-right" : "text-left"}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {po.items.map((it, index) => (
              <tr key={it.id} className="border-t">
                <td className="px-2 py-2 font-medium">{it.name ?? it.productId.slice(0, 8)}</td>
                <td className="px-2 py-2">{it.pack || "—"}</td>
                <td className="px-2 py-2">{it.batch || "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(it.quantity) || 0}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(it.tabQty) || 0}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(it.freeQty) || 0}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(it.rate)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(it.discountPercent) || 0}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatINR(money[index]?.taxable ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span className="tabular-nums">{formatINR(totals.goods)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span className="tabular-nums">{formatINR(totals.discount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t("challanGst")}</span><span className="tabular-nums">{formatINR(totals.gst)}</span></div>
        <div className="flex justify-between border-t pt-1 font-display text-lg font-bold"><span>{t("total")}</span><span className="tabular-nums">{formatINR(totals.net)}</span></div>
      </div>
    </div>
  );
}

interface Props {
  poId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

interface Reorder {
  message: string;
  phone: string;
  waLink: string | null;
  hasPo: boolean;
}

export function PoDetailDialog({ poId, onOpenChange, onChanged }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"received" | "cancelled" | "delete" | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!poId) return;
    let cancelled = false;
    apiFetch<{ purchaseOrder: PurchaseOrderDetail }>(`/api/purchase-orders/${poId}`)
      .then((data) => {
        if (!cancelled) setDetail(data.purchaseOrder);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : t("error"));
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [poId, onOpenChange, t]);

  if (!poId) return null;

  const close = () => {
    setDetail(null);
    onOpenChange(false);
  };

  const setStatus = async (status: "sent" | "received" | "cancelled") => {
    setBusyAction(status);
    try {
      await apiFetch(`/api/purchase-orders/${poId}/status`, { method: "PATCH", body: { status } });
      toast.success(t("success"));
      setConfirm(null);
      close();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyAction(null);
    }
  };

  const remove = async () => {
    setBusyAction("delete");
    try {
      await apiFetch(`/api/purchase-orders/${poId}`, { method: "DELETE" });
      toast.success(t("success"));
      setConfirm(null);
      close();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyAction(null);
    }
  };

  const reorder = async () => {
    if (!detail) return;
    setBusyAction("reorder");
    try {
      const data = await apiFetch<Reorder>(`/api/suppliers/${detail.supplierId}/reorder-message`);
      if (!data.waLink) {
        toast.error(t("reorderNeedsPhone"));
        return;
      }
      window.open(data.waLink, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyAction(null);
    }
  };

  const po = detail;

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto p-3 sm:max-w-5xl">
          {loading || !po ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{po.poNumber} <PoStatusBadge status={po.status} /></DialogTitle>
                <DialogDescription>
                  {po.supplierName} · {t("orderDate")}: {formatDateTime(po.orderDate)}
                </DialogDescription>
              </DialogHeader>

              <ChallanView po={po} />

              <DialogFooter className="flex-wrap gap-2 sm:justify-end">
                {po.status === "draft" && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="size-4" /> {t("editPo")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={busyAction === "sent"} onClick={() => void setStatus("sent")}>
                      {busyAction === "sent" ? <Loader2 className="size-4 animate-spin" /> : null} {t("markSent")}
                    </Button>
                    <Button type="button" size="sm" disabled={busyAction === "received"} onClick={() => setConfirm("received")}>
                      {t("markReceived")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busyAction === "cancelled"} onClick={() => setConfirm("cancelled")}>
                      {t("cancelPo")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busyAction === "delete"} onClick={() => setConfirm("delete")}>
                      {t("delete")}
                    </Button>
                  </>
                )}
                {po.status === "sent" && (
                  <>
                    <Button type="button" size="sm" disabled={busyAction === "received"} onClick={() => setConfirm("received")}>
                      {t("markReceived")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busyAction === "cancelled"} onClick={() => setConfirm("cancelled")}>
                      {t("cancelPo")}
                    </Button>
                  </>
                )}
                {po.status === "received" && (
                  <Button type="button" variant="outline" size="sm" disabled={busyAction === "reorder"} onClick={() => void reorder()}>
                    <MessageCircle className="size-4" /> {t("reorderWhatsapp")}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/suppliers/${po.supplierId}`)}>
                  {t("viewSupplier")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "received" ? t("markReceived") : confirm === "cancelled" ? t("cancelPo") : t("deletePo")}
            </DialogTitle>
            <DialogDescription>
              {confirm === "received"
                ? t("receiveConfirm")
                : confirm === "cancelled"
                  ? t("cancelConfirm")
                  : t("deletePoConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{t("cancel")}</Button>
            <PendingButton
              variant={confirm === "received" ? "default" : "destructive"}
              busy={busyAction !== null}
              onClick={() => {
                if (confirm === "received") void setStatus("received");
                else if (confirm === "cancelled") void setStatus("cancelled");
                else void remove();
              }}
            >
              {t("confirm")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {po && (
        <PurchaseOrderFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          supplierId={po.supplierId}
          supplierName={po.supplierName}
          editing={po}
          onSaved={() => {
            setDetail(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}