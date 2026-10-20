"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2, HandCoins, MessageCircle, FileText, FilePlus2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import type { Supplier, SupplierSummary } from "@/lib/types";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TableSearch } from "@/components/shared/table-search";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { PendingButton } from "@/components/shared/pending-button";
import { SupplierSummaryBar } from "@/components/suppliers/summary-bar";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { PaymentDialog } from "@/components/suppliers/payment-dialog";
import { PurchaseOrderFormDialog } from "@/components/suppliers/po-form-dialog";

export default function SuppliersPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [summary, setSummary] = useState<SupplierSummary | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "outstanding" | "settled">("all");
  const [page, setPage] = useState(1);

  // Dialogs state
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Supplier | null>(null);
  const [poSupplierTarget, setPoSupplierTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 50;

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiFetch<SupplierSummary>("/api/suppliers/summary");
      setSummary(data);
    } catch {
      // Non-critical summary error
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (filter !== "all") params.set("filter", filter);

      const data = await apiFetch<{ suppliers: Supplier[]; total: number }>(`/api/suppliers?${params}`);
      setSuppliers(data.suppliers);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorLoadSuppliers"));
    } finally {
      setLoading(false);
    }
  }, [search, filter, page, t]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleReorderWhatsApp = async (supplier: Supplier) => {
    try {
      const res = await apiFetch<{ message: string; phone: string; waLink: string }>(
        `/api/suppliers/${supplier.id}/reorder-message`
      );
      if (res.waLink) {
        window.open(res.waLink, "_blank", "noopener,noreferrer");
      } else {
        toast.info(t("reorderCopied"), { description: res.message });
        await navigator.clipboard.writeText(res.message);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorReorderMessage"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/suppliers/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(t("supplierArchived"));
      setDeleteTarget(null);
      void loadSuppliers();
      void loadSummary();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorDeleteSupplier"));
    } finally {
      setDeleting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("suppliers")}</h1>
          <p className="text-xs text-muted-foreground">{t("supplierCount", { count: total })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/suppliers/orders")}>
            <FileText className="size-4" /> {t("purchaseOrders")}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> {t("addSupplier")}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <SupplierSummaryBar summary={summary} />

      {/* Filter & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <TableSearch
            value={search}
            onChange={(v: string) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1 text-xs">
          <button
            type="button"
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setFilter("all"); setPage(1); }}
          >
            {t("all")}
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "outstanding" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setFilter("outstanding"); setPage(1); }}
          >
            {t("outstanding")}
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 font-medium transition ${
              filter === "settled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setFilter("settled"); setPage(1); }}
          >
            {t("settled")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : suppliers.length === 0 ? (
          <EmptyState message={t("noData")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("supplierName")}</TableHead>
                <TableHead>{t("supplierPhone")}</TableHead>
                <TableHead>{t("supplierCategory")}</TableHead>
                <TableHead className="text-right">{t("totalPurchases")}</TableHead>
                <TableHead className="text-right">{t("totalPayable")}</TableHead>
                <TableHead>{t("lastOrderDate")}</TableHead>
                <TableHead className="w-48 text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => {
                const payable = Number(s.outstandingPayable ?? 0);
                const purchases = Number(s.totalPurchases ?? 0);

                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => router.push(`/suppliers/${s.id}`)}
                        className="hover:underline text-left"
                      >
                        {s.name}
                      </button>
                      {s.gstin && <p className="text-[11px] text-muted-foreground">{t("gstLabel")}: {s.gstin}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.phone || "-"}</TableCell>
                    <TableCell>
                      {s.category ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {s.category}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(purchases)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${payable > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatINR(payable)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.lastOrderDate ? formatDateTime(s.lastOrderDate) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/suppliers/${s.id}`)}
                          title={t("viewDetails")}
                          aria-label={t("viewDetails")}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditTarget(s)}
                          title={t("edit")}
                          aria-label={t("edit")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {payable > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPaymentTarget(s)}
                            title={t("recordPayment")}
                            aria-label={t("recordPayment")}
                          >
                            <HandCoins className="size-4 text-amber-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleReorderWhatsApp(s)}
                          title={t("reorderWhatsApp")}
                          aria-label={t("reorderWhatsApp")}
                        >
                          <MessageCircle className="size-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPoSupplierTarget(s)}
                          title={t("newPurchaseOrder")}
                          aria-label={t("newPurchaseOrder")}
                        >
                          <FilePlus2 className="size-4 text-sky-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(s)}
                          title={t("delete")}
                          aria-label={t("delete")}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Pager page={page} pages={pages} onPageChange={setPage} />

      {/* Add Supplier Dialog */}
      <SupplierFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        editing={null}
        onSaved={() => {
          void loadSuppliers();
          void loadSummary();
        }}
      />

      {/* Edit Supplier Dialog */}
      <SupplierFormDialog
        open={!!editTarget}
        onOpenChange={(open: boolean) => { if (!open) setEditTarget(null); }}
        editing={editTarget}
        onSaved={() => {
          setEditTarget(null);
          void loadSuppliers();
        }}
      />

      {/* Record Payment Dialog */}
      <PaymentDialog
        open={!!paymentTarget}
        onOpenChange={(open: boolean) => { if (!open) setPaymentTarget(null); }}
        supplier={paymentTarget}
        onSaved={() => {
          setPaymentTarget(null);
          void loadSuppliers();
          void loadSummary();
        }}
      />

      {/* PO Form Dialog */}
      {poSupplierTarget && (
        <PurchaseOrderFormDialog
          open={!!poSupplierTarget}
          onOpenChange={(open: boolean) => { if (!open) setPoSupplierTarget(null); }}
          supplierId={poSupplierTarget.id}
          supplierName={poSupplierTarget.name}
          editing={null}
          onSaved={() => {
            setPoSupplierTarget(null);
            void loadSuppliers();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSupplier")}</DialogTitle>
            <DialogDescription>
              {t("confirmDelete")} {deleteTarget?.name}. {t("actionCannotBeUndone")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <PendingButton variant="destructive" onClick={() => void confirmDelete()} busy={deleting}>
              {t("delete")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}