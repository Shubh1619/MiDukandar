"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  History,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
} from "lucide-react";

import { apiFetch, apiDownload, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import { STATUS_BADGE } from "@/lib/badges";
import type {
  InvoiceSummary,
  Sale,
  SaleDetail,
  InvoiceData,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
import { InvoiceSummaryBar } from "@/components/invoices/invoice-summary";
import { InvoiceFormDialog, type HeldPayload } from "@/components/invoices/invoice-form-dialog";
import { HeldBillsDialog } from "@/components/invoices/held-bills-dialog";
import { InvoicePreview } from "@/components/invoices/invoice-preview";

type PaymentFilter = "all" | "paid" | "udhaar";

const CONFIRMED = "CONFIRMED";
const REVERSED = "REVERSED";

function fmtDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

export default function InvoicesPage() {
  const { t } = useI18n();

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payment, setPayment] =
    useState<PaymentFilter>("all");

  const [page, setPage] = useState(1);

  const [viewing, setViewing] =
    useState<InvoiceData | null>(null);

  const [viewingNumber, setViewingNumber] =
    useState("");

  const [viewingId, setViewingId] =
    useState("");

  const [invoiceLoading, setInvoiceLoading] =
    useState(false);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editing, setEditing] =
    useState<SaleDetail | null>(null);

  const [heldOpen, setHeldOpen] =
    useState(false);

  const [heldDraft, setHeldDraft] =
    useState<{ id: string; payload: HeldPayload } | null>(null);

  const [busyEditId, setBusyEditId] =
    useState<string | null>(null);

  const [paying, setPaying] =
    useState<Sale | null>(null);

  const [voiding, setVoiding] =
    useState<Sale | null>(null);

  const [voidReason, setVoidReason] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const limit = 50;

  const hasFilters = !!(
    search.trim() ||
    from ||
    to ||
    payment !== "all"
  );

  /* =========================================================
     LOAD INVOICES
     ========================================================= */

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (from) {
          params.set("from", from);
        }

        if (to) {
          params.set("to", to);
        }

        if (payment !== "all") {
          params.set(
            "payment",
            payment === "udhaar"
              ? "UNPAID"
              : payment.toUpperCase()
          );
        }

        const data = await apiFetch<{
          sales: Sale[];
          total: number;
          summary: InvoiceSummary;
        }>(`/api/sales?${params}`);

        setSales(data.sales);
        setTotal(data.total);
        setSummary(data.summary);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : t("error")
        );
      } finally {
        setLoading(false);
      }
    },
    [search, from, to, payment, page, t]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /* =========================================================
     FILTERS
     ========================================================= */

  const clearFilters = useCallback(() => {
    setSearch("");
    setFrom("");
    setTo("");
    setPayment("all");
    setPage(1);
  }, []);

  /* =========================================================
     VIEW INVOICE
     ========================================================= */

  const viewInvoice = async (
    id: string,
    number: string
  ) => {
    setViewingNumber(number);
    setViewingId(id);
    setInvoiceLoading(true);
    setViewing(null);

    try {
      const data = await apiFetch<{
        invoice: InvoiceData;
      }>(`/api/sales/${id}/invoice`);

      setViewing(data.invoice);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("error")
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  /* =========================================================
     CREATE
     ========================================================= */

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  /* =========================================================
     EDIT
     ========================================================= */

  const openEdit = async (sale: Sale) => {
    setBusyEditId(sale.id);

    try {
      const data = await apiFetch<{
        sale: SaleDetail;
      }>(`/api/sales/${sale.id}`);

      setEditing(data.sale);
      setFormOpen(true);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("error")
      );
    } finally {
      setBusyEditId(null);
    }
  };

  /* =========================================================
     MARK PAID
     ========================================================= */

  const markPaid = async () => {
    if (!paying) return;

    setBusy(true);

    try {
      await apiFetch(
        `/api/sales/${paying.id}/pay`,
        {
          method: "POST",
          body: {
            amount: Number(paying.dueAmount),
            mode: "CASH",
          },
        }
      );

      toast.success(t("success"));

      setPaying(null);

      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("error")
      );
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     VOID SALE
     ========================================================= */

  const voidSale = async () => {
    if (!voiding) return;

    if (voidReason.trim().length < 2) {
      toast.error(t("reasonRequired"));
      return;
    }

    setBusy(true);

    try {
      await apiFetch(
        `/api/sales/${voiding.id}/reverse`,
        {
          method: "POST",
          body: {
            reason: voidReason.trim(),
          },
        }
      );

      toast.success(t("success"));

      setVoiding(null);
      setVoidReason("");

      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t("error")
      );
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  /* =========================================================
     FILTER UI
     ========================================================= */

  const renderFilters = () => (
    <div className="space-y-3 p-1">
      <TableSearch
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        className="w-full"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          aria-label={t("from")}
        />

        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          aria-label={t("to")}
        />
      </div>

      <Select
        value={payment}
        onValueChange={(v) => {
          setPayment(v as PaymentFilter);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">
            {t("all")}
          </SelectItem>

          <SelectItem value="paid">
            {t("paid")}
          </SelectItem>

          <SelectItem value="udhaar">
            {t("udhaar")}
          </SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            clearFilters();
            setFiltersOpen(false);
          }}
        >
          {t("clearFilters")}
        </Button>
      )}
    </div>
  );

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">
            {t("invoices")}
          </h1>

          <p className="text-xs text-muted-foreground">
            {total} {t("invoices")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHeldOpen(true)}>
            <History className="size-4" />
            {t("heldBills")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("newInvoice")}
          </Button>
        </div>
      </div>

      {/* SUMMARY */}
      <InvoiceSummaryBar
        summary={summary}
        loading={loading}
      />

      {/* FILTER BAR */}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">

        <TableSearch
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          className="hidden flex-1 md:block"
        />

        {/* MOBILE FILTER */}
        <div className="flex gap-2 md:hidden">
          <Button
            variant="outline"
            className="flex-1 justify-center"
            onClick={() => setFiltersOpen(true)}
          >
            Filters
          </Button>

          {hasFilters && (
            <Button
              variant="ghost"
              className="flex-1 justify-center"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
        </div>

        {/* DESKTOP FILTERS */}
        <div className="hidden md:flex md:items-center md:gap-2">

          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            aria-label={t("from")}
            className="w-40"
          />

          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            aria-label={t("to")}
            className="w-40"
          />

          <Select
            value={payment}
            onValueChange={(v) => {
              setPayment(v as PaymentFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                {t("all")}
              </SelectItem>

              <SelectItem value="paid">
                {t("paid")}
              </SelectItem>

              <SelectItem value="udhaar">
                {t("udhaar")}
              </SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {/* INVOICE TABLE */}
      <div className="rounded-lg border bg-card">

        {loading ? (
          <TableSkeleton rows={6} />

        ) : sales.length === 0 ? (

          !hasFilters ? (
            <EmptyState message={t("noInvoices")}>
              <Button
                className="mt-3"
                onClick={openCreate}
              >
                <Plus className="size-4" />
                {t("createFirstInvoice")}
              </Button>
            </EmptyState>
          ) : (
            <EmptyState message={t("noData")}>
              <Button
                variant="outline"
                className="mt-3"
                onClick={clearFilters}
              >
                {t("clearFilters")}
              </Button>
            </EmptyState>
          )

        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("invoiceNumber")}
                    </TableHead>

                    <TableHead>
                      {t("date")}
                    </TableHead>

                    <TableHead>
                      {t("customer")}
                    </TableHead>

                    <TableHead className="text-right">
                      {t("amount")}
                    </TableHead>

                    <TableHead>
                      {t("paymentMode")}
                    </TableHead>

                    <TableHead>
                      {t("status")}
                    </TableHead>

                    <TableHead className="w-12 text-right">
                      {t("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>

                      <TableCell className="font-medium">
                        {s.invoiceNumber}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDateTime(
                          s.createdAt
                        )}
                      </TableCell>

                      <TableCell>
                        {s.customerName ??
                          t("walkIn")}
                      </TableCell>

                      <TableCell className="text-right">
                        <p className="font-semibold tabular-nums">
                          {formatINR(s.total)}
                        </p>

                        {Number(s.dueAmount) > 0 && (
                          <p className="text-[11px] text-destructive tabular-nums">
                            {t("due")}{" "}
                            {formatINR(
                              s.dueAmount
                            )}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        {s.paymentMode}
                      </TableCell>

                      <TableCell>
                        {s.status === REVERSED ? (
                          <Badge
                            variant="outline"
                            className={
                              STATUS_BADGE.REVERSED
                            }
                          >
                            {t("reversed")}
                          </Badge>
                        ) : Number(
                            s.dueAmount
                          ) > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-700"
                          >
                            {t("udhaar")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-700"
                          >
                            {t("paid")}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>

                          <DropdownMenuTrigger
                            asChild
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t(
                                "actions"
                              )}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">

                            <DropdownMenuItem
                              onSelect={() =>
                                void viewInvoice(
                                  s.id,
                                  s.invoiceNumber
                                )
                              }
                            >
                              <Eye className="size-4" />
                              {t("viewInvoice")}
                            </DropdownMenuItem>

                            {s.status ===
                              CONFIRMED && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  void openEdit(s)
                                }
                                disabled={
                                  busyEditId ===
                                  s.id
                                }
                              >
                                {busyEditId ===
                                s.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Pencil className="size-4" />
                                )}

                                {t("editInvoice")}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onSelect={() =>
                                void apiDownload(
                                  `/api/sales/${s.id}/invoice/pdf`,
                                  `${s.invoiceNumber}.pdf`
                                )
                              }
                            >
                              <Printer className="size-4" />
                              {t("downloadPdf")}
                            </DropdownMenuItem>

                            {s.status ===
                              CONFIRMED &&
                              Number(
                                s.dueAmount
                              ) > 0 && (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setPaying(s)
                                  }
                                >
                                  <Lock className="size-4" />
                                  {t(
                                    "markAsPaid"
                                  )}
                                </DropdownMenuItem>
                              )}

                            {s.status ===
                              CONFIRMED && (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  setVoiding(s);
                                  setVoidReason(
                                    ""
                                  );
                                }}
                              >
                                <RotateCcw className="size-4" />
                                {t("voidInvoice")}
                              </DropdownMenuItem>
                            )}

                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* MOBILE CARDS */}
            <div className="space-y-2 p-3 md:hidden">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900">
                        {s.invoiceNumber}
                      </p>

                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.customerName ??
                          t("walkIn")}
                      </p>
                    </div>

                    {s.status === REVERSED ? (
                      <Badge
                        variant="outline"
                        className={
                          STATUS_BADGE.REVERSED
                        }
                      >
                        {t("reversed")}
                      </Badge>
                    ) : Number(
                        s.dueAmount
                      ) > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700"
                      >
                        {t("udhaar")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700"
                      >
                        {t("paid")}
                      </Badge>
                    )}

                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(
                        s.createdAt
                      )}
                    </span>

                    <span className="text-sm font-bold tabular-nums">
                      {formatINR(s.total)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">

                    <span className="text-[11px] text-muted-foreground">
                      {s.paymentMode}
                    </span>

                    <div className="flex items-center gap-2">

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void viewInvoice(
                            s.id,
                            s.invoiceNumber
                          )
                        }
                      >
                        View
                      </Button>

                      <DropdownMenu>

                        <DropdownMenuTrigger
                          asChild
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t(
                              "actions"
                            )}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">

                          <DropdownMenuItem
                            onSelect={() =>
                              void viewInvoice(
                                s.id,
                                s.invoiceNumber
                              )
                            }
                          >
                            <Eye className="size-4" />
                            {t("viewInvoice")}
                          </DropdownMenuItem>

                          {s.status ===
                            CONFIRMED && (
                            <DropdownMenuItem
                              onSelect={() =>
                                void openEdit(s)
                              }
                              disabled={
                                busyEditId ===
                                s.id
                              }
                            >
                              {busyEditId ===
                              s.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Pencil className="size-4" />
                              )}

                              {t("editInvoice")}
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onSelect={() =>
                              void apiDownload(
                                `/api/sales/${s.id}/invoice/pdf`,
                                `${s.invoiceNumber}.pdf`
                              )
                            }
                          >
                            <Printer className="size-4" />
                            {t("downloadPdf")}
                          </DropdownMenuItem>

                          {s.status ===
                            CONFIRMED &&
                            Number(
                              s.dueAmount
                            ) > 0 && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  setPaying(s)
                                }
                              >
                                <Lock className="size-4" />
                                {t(
                                  "markAsPaid"
                                )}
                              </DropdownMenuItem>
                            )}

                          {s.status ===
                            CONFIRMED && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setVoiding(s);
                                setVoidReason(
                                  ""
                                );
                              }}
                            >
                              <RotateCcw className="size-4" />
                              {t(
                                "voidInvoice"
                              )}
                            </DropdownMenuItem>
                          )}

                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* PAGINATION */}
      {sales.length > 0 && (
        <Pager
          page={page}
          pages={pages}
          onPageChange={setPage}
        />
      )}

      {/* CREATE / EDIT */}
      {formOpen && (
        <InvoiceFormDialog
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setHeldDraft(null);
          }}
          onSaved={() => void load()}
          editing={editing}
          held={heldDraft}
        />
      )}

      {/* HELD BILLS */}
      {heldOpen && (
        <HeldBillsDialog
          onClose={() => setHeldOpen(false)}
          onResume={({ id, payload }) => {
            setHeldOpen(false);
            setEditing(null);
            setHeldDraft({ id, payload });
            setFormOpen(true);
          }}
        />
      )}

      {/* MARK AS PAID */}
      <AlertDialog
        open={!!paying}
        onOpenChange={(o) =>
          !o &&
          !busy &&
          setPaying(null)
        }
      >
        <AlertDialogContent size="sm">

          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("markAsPaid")}
            </AlertDialogTitle>

            {paying && (
              <AlertDialogDescription>
                {paying.invoiceNumber} ·{" "}
                {t("markPaidConfirm")}{" "}
                {formatINR(
                  paying.dueAmount
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel
              disabled={busy}
              onClick={() =>
                setPaying(null)
              }
            >
              {t("cancel")}
            </AlertDialogCancel>

            <AlertDialogAction
              variant="default"
              disabled={busy}
              onClick={() =>
                void markPaid()
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("markAsPaid")
              )}
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* VOID INVOICE */}
      <AlertDialog
        open={!!voiding}
        onOpenChange={(o) =>
          !o &&
          !busy &&
          setVoiding(null)
        }
      >
        <AlertDialogContent>

          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("voidInvoice")}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {voiding
                ? `${voiding.invoiceNumber} · `
                : ""}
              {t("voidConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label>
              {t("reason")}
            </Label>

            <Textarea
              value={voidReason}
              onChange={(e) =>
                setVoidReason(
                  e.target.value
                )
              }
              rows={2}
              placeholder={t(
                "reasonRequired"
              )}
            />
          </div>

          <AlertDialogFooter>

            <AlertDialogCancel
              disabled={busy}
              onClick={() =>
                setVoiding(null)
              }
            >
              {t("cancel")}
            </AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              disabled={
                busy ||
                voidReason.trim()
                  .length < 2
              }
              onClick={() =>
                void voidSale()
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("voidInvoice")
              )}
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* =====================================================
          VIEW INVOICE - WIDE VERSION
          ===================================================== */}

      <Dialog
        open={
          invoiceLoading || !!viewing
        }
        onOpenChange={(o) =>
          !o && setViewing(null)
        }
      >
        <DialogContent
          className="
            !w-[96vw]
            !max-w-none
            sm:!w-[94vw]
            sm:!max-w-[1180px]
            lg:!w-[92vw]
            lg:!max-w-[1200px]
            h-[90vh]
            sm:h-[92vh]
            flex
            flex-col
            gap-0
            overflow-hidden
            !p-0
            !rounded-2xl
            sm:!rounded-2xl
          "
        >

          {/* INVOICE PREVIEW */}
          <div
            className="
              min-h-0
              flex-1
              overflow-y-auto
              overflow-x-hidden
              px-4
              py-5
              sm:px-8
              sm:py-6
              lg:px-10
              lg:py-7
            "
          >
            {invoiceLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewing ? (
              <InvoicePreview
                data={viewing}
                variant="modal"
              />
            ) : null}
          </div>

          {/* INVOICE ACTIONS */}
          {viewing && (
            <DialogFooter
              className="
                shrink-0
                flex-col
                gap-2
                !-mb-0
                !mb-0
                !mt-0
                !border-t
                !border-border/80
                !bg-background
                !px-4
                !py-3
                !pb-4
                sm:!px-6
                sm:!py-3.5
                sm:!pb-4.5
                sm:flex-row
                sm:items-center
                sm:justify-end
                [&>*]:mb-0
                [&_button]:mb-0
                [&_a]:mb-0
              "
            >

              {/* WHATSAPP */}
              <Button
                variant="outline"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Bill ${
                      viewing.invoiceNumber
                    } - Total ${formatINR(
                      viewing.total
                    )}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" />
                  {t("whatsappShare")}
                </a>
              </Button>

              {/* PRINT */}
              <Button
                variant="outline"
                onClick={() => {
                  window.print();
                }}
                className="w-full sm:w-auto"
              >
                <Printer className="size-4" />
                Print
              </Button>

              {/* DOWNLOAD PDF */}
              <Button
                onClick={() =>
                  viewingId &&
                  void apiDownload(
                    `/api/sales/${viewingId}/invoice/pdf`,
                    `${viewing.invoiceNumber}.pdf`
                  )
                }
                className="w-full sm:w-auto"
              >
                <Printer className="size-4" />
                {t("printInvoice")}
              </Button>

            </DialogFooter>
          )}

        </DialogContent>
      </Dialog>

    </div>
  );
}