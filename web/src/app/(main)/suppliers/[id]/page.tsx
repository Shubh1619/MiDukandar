"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, HandCoins, MessageCircle, Pencil, FileText, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import type { SupplierDetail, PurchaseOrder } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { PaymentDialog } from "@/components/suppliers/payment-dialog";
import { PurchaseOrderFormDialog } from "@/components/suppliers/po-form-dialog";
import { PoDetailDialog } from "@/components/suppliers/po-detail-dialog";
import { PoStatusBadge } from "@/components/suppliers/po-status-badge";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();

  const [data, setData] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  const loadSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<SupplierDetail>(`/api/suppliers/${id}`);
      setData(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load supplier details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSupplier();
  }, [loadSupplier]);

  const handleReorderWhatsApp = async () => {
    if (!data) return;
    try {
      const res = await apiFetch<{ message: string; phone: string; waLink: string }>(
        `/api/suppliers/${id}/reorder-message`
      );
      if (res.waLink) {
        window.open(res.waLink, "_blank", "noopener,noreferrer");
      } else {
        toast.info("WhatsApp reorder message copied", { description: res.message });
        await navigator.clipboard.writeText(res.message);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate reorder message");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/suppliers")}>
          <ArrowLeft className="size-4" /> {t("back")}
        </Button>
        <EmptyState message={t("noData")} />
      </div>
    );
  }

  const { supplier, purchaseOrders, payments } = data;
  const payable = Number(supplier.outstandingPayable ?? 0);
  const totalPurchases = Number(supplier.totalPurchases ?? 0);

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/suppliers")}>
          <ArrowLeft className="size-4" /> {t("back")} to Suppliers
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> {t("editSupplier")}
        </Button>
      </div>

      {/* Supplier Profile Header Card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-navy-900 font-display text-2xl font-bold text-white shadow-inner">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{supplier.name}</h1>
                {supplier.category && <Badge variant="secondary">{supplier.category}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {supplier.phone && <span>Phone: {supplier.phone}</span>}
                {supplier.email && <span>Email: {supplier.email}</span>}
                {supplier.gstin && <span>GSTIN: {supplier.gstin}</span>}
              </div>
              {supplier.address && <p className="text-xs text-muted-foreground mt-1">{supplier.address}</p>}
            </div>
          </div>

          {/* Outstanding Balance Stat */}
          <div className="flex flex-col items-start sm:items-end rounded-lg border bg-muted/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">{t("totalPayable")}</span>
            <span className={`font-display text-2xl font-bold tabular-nums ${payable > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatINR(payable)}
            </span>
            <span className="text-[11px] text-muted-foreground">Purchases: {formatINR(totalPurchases)}</span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={() => setPoOpen(true)}>
            <Plus className="size-4" /> {t("newPurchaseOrder")}
          </Button>
          <Button
            variant="outline"
            disabled={payable <= 0}
            onClick={() => setPaymentOpen(true)}
          >
            <HandCoins className="size-4 text-amber-600" /> {t("recordPayment")}
          </Button>
          <Button variant="outline" onClick={() => void handleReorderWhatsApp()}>
            <MessageCircle className="size-4 text-emerald-600" /> {t("reorderWhatsApp")}
          </Button>
        </div>
      </div>

      {/* Tabs: Purchase Orders & Payment History */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="size-4" />
            {t("purchaseOrders")} ({purchaseOrders.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <HandCoins className="size-4" />
            {t("paymentHistory")} ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="rounded-lg border bg-card">
            {purchaseOrders.length === 0 ? (
              <EmptyState message="No purchase orders for this supplier." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("poNumber")}</TableHead>
                    <TableHead>{t("orderDate")}</TableHead>
                    <TableHead>{t("expectedDate")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("totalAmount")}</TableHead>
                    <TableHead className="w-24 text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPo(po)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="rounded-lg border bg-card">
            {payments.length === 0 ? (
              <EmptyState message="No payment records for this supplier." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("paymentMode")}</TableHead>
                    <TableHead>{t("poNumber")}</TableHead>
                    <TableHead>{t("notes")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{formatDateTime(p.paymentDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.paymentMode}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.poNumber || "General"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{p.note || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                        {formatINR(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Supplier Modal */}
      <SupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={supplier}
        onSaved={() => void loadSupplier()}
      />

      {/* Record Payment Modal */}
      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        supplier={supplier}
        onSaved={() => void loadSupplier()}
      />

      {/* New Purchase Order Modal */}
      <PurchaseOrderFormDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        supplierId={supplier.id}
        supplierName={supplier.name}
        editing={null}
        onSaved={() => void loadSupplier()}
      />

      {/* View PO Detail Modal */}
      <PoDetailDialog
        key={selectedPo?.id ?? "none"}
        poId={selectedPo ? selectedPo.id : null}
        onOpenChange={(open: boolean) => { if (!open) setSelectedPo(null); }}
        onChanged={() => void loadSupplier()}
      />
    </div>
  );
}
