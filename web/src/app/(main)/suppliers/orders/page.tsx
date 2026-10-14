"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ArrowLeft, Eye, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import type { PurchaseOrder, Supplier, PurchaseOrderStatus, PurchaseOrderDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { PendingButton } from "@/components/shared/pending-button";
import { PurchaseOrderFormDialog } from "@/components/suppliers/po-form-dialog";
import { PoDetailDialog } from "@/components/suppliers/po-detail-dialog";
import { PoStatusBadge } from "@/components/suppliers/po-status-badge";

export default function PurchaseOrdersPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [supplierId, setSupplierId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseOrderDetail | null>(null);
  const [detailTarget, setDetailTarget] = useState<PurchaseOrder | null>(null);

  // Confirm status change state
  const [statusTarget, setStatusTarget] = useState<{ po: PurchaseOrder; nextStatus: PurchaseOrderStatus } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const limit = 50;

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await apiFetch<{ suppliers: Supplier[] }>("/api/suppliers?limit=200");
      setSuppliers(data.suppliers);
    } catch {
      // Non-critical
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (supplierId !== "all") params.set("supplierId", supplierId);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await apiFetch<{ orders: PurchaseOrder[]; total: number }>(`/api/purchase-orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, [supplierId, statusFilter, page]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleEdit = async (po: PurchaseOrder) => {
    try {
      const data = await apiFetch<{ purchaseOrder: PurchaseOrderDetail }>(`/api/purchase-orders/${po.id}`);
      setEditTarget(data.purchaseOrder);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to fetch purchase order details");
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/api/purchase-orders/${statusTarget.po.id}/status`, {
        method: "PATCH",
        body: { status: statusTarget.nextStatus },
      });
      toast.success(
        statusTarget.nextStatus === "received"
          ? "Purchase order marked as Received! Inventory stock updated."
          : `Order status updated to ${statusTarget.nextStatus}`
      );
      setStatusTarget(null);
      void loadOrders();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/suppliers")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">{t("purchaseOrders")}</h1>
            <p className="text-xs text-muted-foreground">{total} order(s)</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> {t("newPurchaseOrder")}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">{t("supplier")}:</label>
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">{t("status")}:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <EmptyState message="No purchase orders found." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("poNumber")}</TableHead>
                <TableHead>{t("supplierName")}</TableHead>
                <TableHead>{t("orderDate")}</TableHead>
                <TableHead>{t("expectedDate")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("totalAmount")}</TableHead>
                <TableHead className="w-44 text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => router.push(`/suppliers/${po.supplierId}`)}
                      className="hover:underline text-left"
                    >
                      {po.supplierName}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(po.orderDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {po.expectedDate ? formatDateTime(po.expectedDate) : "-"}
                  </TableCell>
                  <TableCell>
                    <PoStatusBadge status={po.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatINR(po.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailTarget(po)}
                        title={t("viewDetails")}
                        aria-label={t("viewDetails")}
                      >
                        <Eye className="size-4" />
                      </Button>

                      {po.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleEdit(po)}
                          title={t("edit")}
                          aria-label={t("edit")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}

                      {(po.status === "draft" || po.status === "sent") && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setStatusTarget({ po, nextStatus: "received" })}
                            title="Mark Received (Updates Stock)"
                            aria-label="Mark Received"
                          >
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setStatusTarget({ po, nextStatus: "cancelled" })}
                            title="Cancel Order"
                            aria-label="Cancel Order"
                          >
                            <XCircle className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pager page={page} pages={pages} onPageChange={setPage} />

      {/* Create PO Dialog */}
      <PurchaseOrderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editing={null}
        onSaved={() => void loadOrders()}
      />

      {/* Edit PO Dialog */}
      {editTarget && (
        <PurchaseOrderFormDialog
          open={!!editTarget}
          onOpenChange={(open: boolean) => { if (!open) setEditTarget(null); }}
          supplierId={editTarget.supplierId}
          supplierName={editTarget.supplierName}
          editing={editTarget}
          onSaved={() => {
            setEditTarget(null);
            void loadOrders();
          }}
        />
      )}

      {/* View PO Detail Dialog */}
      <PoDetailDialog
        poId={detailTarget ? detailTarget.id : null}
        onOpenChange={(open: boolean) => { if (!open) setDetailTarget(null); }}
        onChanged={() => void loadOrders()}
      />

      {/* Confirm Status Change Dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.nextStatus === "received" ? "Mark Purchase Order as Received?" : "Cancel Purchase Order?"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.nextStatus === "received" ? (
                <span className="text-amber-600 font-medium">
                  {t("stockWillUpdate")} Quantities for all line items will be added to your inventory.
                </span>
              ) : (
                `Are you sure you want to cancel order ${statusTarget?.po.poNumber}?`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {t("cancel")}
            </Button>
            <PendingButton
              variant={statusTarget?.nextStatus === "received" ? "default" : "destructive"}
              onClick={() => void handleUpdateStatus()}
              busy={updatingStatus}
            >
              {statusTarget?.nextStatus === "received" ? t("confirmReceive") : t("confirm")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
