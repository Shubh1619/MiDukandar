"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatQty, formatDateTime } from "@/lib/format";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PoStatusBadge } from "./po-status-badge";
import { PurchaseOrderFormDialog } from "./po-form-dialog";
import { PendingButton } from "@/components/shared/pending-button";

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
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"received" | "cancelled" | "delete" | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!poId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {loading || !po ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {po.poNumber} <PoStatusBadge status={po.status} />
                </DialogTitle>
                <DialogDescription>
                  {po.supplierName} · {t("poDate")}: {formatDateTime(po.orderDate)}
                  {po.expectedDate ? ` · ${t("expectedDate")}: ${formatDateTime(po.expectedDate)}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("items")}</TableHead>
                      <TableHead className="text-right">{t("qty")}</TableHead>
                      <TableHead className="text-right">{t("rate")}</TableHead>
                      <TableHead className="text-right">{t("lineTotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.name ?? it.productId.slice(0, 8)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatQty(it.quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(it.rate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(it.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={3}>{t("total")}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatINR(po.totalAmount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

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