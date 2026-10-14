"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Eye, HandCoins, X, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import { UDHAARI_STATUS_BADGE } from "@/lib/badges";
import type {
  Customer,
  UdhaariCustomerRow,
  UdhaariCustomerDetail,
  UdhaariEntry,
  UdhaariReminder,
  UdhaariRemindersResponse,
  UdhaariStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PaymentModeTabs } from "@/components/shared/payment-mode-tabs";
import { PendingButton } from "@/components/shared/pending-button";
import { cn } from "@/lib/utils";

const STATUS_TABS: Array<{ value: "" | UdhaariStatus; labelKey: string }> = [
  { value: "", labelKey: "all" },
  { value: "PENDING", labelKey: "pendingOnly" },
  { value: "PARTIAL", labelKey: "partial" },
  { value: "PAID", labelKey: "paid" },
];

const REMINDER_SCOPES: Array<{ value: "all" | "overdue" | "today" | "upcoming"; labelKey: string }> = [
  { value: "all", labelKey: "all" },
  { value: "overdue", labelKey: "overdue" },
  { value: "today", labelKey: "dueToday" },
  { value: "upcoming", labelKey: "upcoming" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateOnly(d: string | null | undefined): string {
  if (!d) return "-";
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** A reminder row shaped like an entry so the existing pay dialog can target it. */
function reminderToEntry(r: UdhaariReminder): UdhaariEntry {
  return {
    id: r.entryId,
    amount: r.amount,
    entryDate: r.dueDate ?? "",
    dueDate: r.dueDate,
    reminderDate: r.reminderDate,
    saleId: r.saleId,
    invoiceNumber: r.invoiceNumber,
    note: r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : null,
    createdAt: r.createdAt,
    paid: r.paid,
    remaining: r.remaining,
    status: r.status,
    payments: [],
  };
}

/** Name-based autocomplete: suggests existing customers as the user types; typing an unmatching name
 *  falls through to a free-entry customer created on save. */
function CustomerNameLookup({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: Customer) => void;
}) {
  const { t } = useI18n();
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
        placeholder={t("searchCustomer")}
        className="pr-8"
      />
      {busy && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && options.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md ring-1 ring-foreground/10">
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

function UdhaariPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");

  const [rows, setRows] = useState<UdhaariCustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | UdhaariStatus>("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const [addOpen, setAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [note, setNote] = useState("");
  const [payStatus, setPayStatus] = useState<UdhaariStatus>("PENDING");
  const [initialPaid, setInitialPaid] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<UdhaariCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payEntry, setPayEntry] = useState<UdhaariEntry | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("CASH");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  const [view, setView] = useState<"entries" | "reminders">("entries");
  const [reminders, setReminders] = useState<UdhaariReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderScope, setReminderScope] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [reminderSearch, setReminderSearch] = useState("");
  const [reminderCounts, setReminderCounts] = useState({ overdue: 0, today: 0, upcoming: 0 });

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    try {
      const params = new URLSearchParams({ scope: reminderScope });
      if (reminderSearch.trim()) params.set("search", reminderSearch.trim());
      const data = await apiFetch<UdhaariRemindersResponse>(`/api/udhaari/reminders?${params}`);
      setReminders(data.reminders);
      setReminderCounts(data.counts);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load reminders");
    } finally {
      setRemindersLoading(false);
    }
  }, [reminderScope, reminderSearch]);

  useEffect(() => {
    if (view === "reminders") void loadReminders();
  }, [view, loadReminders]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (customerIdParam) params.set("customerId", customerIdParam);
      const data = await apiFetch<{ customers: UdhaariCustomerRow[]; total: number }>(`/api/udhaari?${params}`);
      setRows(data.customers);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load udhaari");
    } finally {
      setLoading(false);
    }
  }, [search, status, page, customerIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (customerId: string) => {
    setDetailLoading(true);
    setDetail(null);
    setDetailOpen(true);
    try {
      const data = await apiFetch<UdhaariCustomerDetail>(`/api/udhaari/${customerId}`);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load udhaari history");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customerIdParam) void openDetail(customerIdParam);
  }, [customerIdParam, openDetail]);

  const openAdd = async () => {
    setAddOpen(true);
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerMobile("");
    setCustomerAddress("");
    setAmount("");
    setEntryDate(todayStr());
    setDueDate("");
    setReminderDate("");
    setNote("");
    setPayStatus("PENDING");
    setInitialPaid("");
  };

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

  const submitCreate = async () => {
    const name = customerName.trim();
    if (!name) {
      toast.error(t("customerRequired"));
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await apiFetch("/api/udhaari", {
        method: "POST",
        body: {
          customerId: selectedCustomer ? selectedCustomer.id : undefined,
          customer: selectedCustomer
            ? undefined
            : {
                name,
                mobile: customerMobile.trim() || undefined,
                address: customerAddress.trim() || undefined,
              },
          amount: amt,
          entryDate,
          dueDate: dueDate || undefined,
          reminderDate: reminderDate || undefined,
          note,
          status: payStatus,
          initialPaid: payStatus === "PARTIAL" ? Number(initialPaid) || 0 : undefined,
        },
      });
      toast.success("Udhaari entry added");
      setAddOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add udhaari entry");
    } finally {
      setSaving(false);
    }
  };

  const openPay = (entry: UdhaariEntry) => {
    setPayEntry(entry);
    setPayAmount(String(entry.remaining || ""));
    setPayMode("CASH");
    setPayNote("");
    setPayOpen(true);
  };

  const submitPay = async () => {
    const amt = Number(payAmount);
    if (!payEntry || !amt || amt <= 0) return;
    setPaying(true);
    try {
      await apiFetch(`/api/udhaari/${payEntry.id}/pay`, {
        method: "POST",
        body: { amount: amt, mode: payMode, note: payNote },
      });
      toast.success("Payment recorded");
      setPayOpen(false);
      void load();
      if (view === "reminders") void loadReminders();
      if (detail?.customer.id) void openDetail(detail.customer.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setPaying(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("navUdhaari")}</h1>
          <p className="text-xs text-muted-foreground">{total} customer(s) with udhaari</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 rounded-lg border bg-card p-1">
            <button
              type="button"
              onClick={() => setView("entries")}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${view === "entries" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("udhaariEntries")}
            </button>
            <button
              type="button"
              onClick={() => setView("reminders")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ${view === "reminders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("reminders")}
              {reminderCounts.overdue > 0 && view !== "reminders" && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{reminderCounts.overdue}</span>
              )}
            </button>
          </div>
          <Button onClick={() => void openAdd()}>
            <Plus className="size-4" /> {t("addUdhaariEntry")}
          </Button>
        </div>
      </div>

      {view === "entries" && (
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <div className="flex gap-1.5 rounded-lg border bg-card p-1">
            {STATUS_TABS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { setStatus(s.value); setPage(1); }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${status === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
          {customerIdParam && (
            <Button variant="outline" size="sm" onClick={() => router.replace("/udhaari")}>
              <X className="size-3.5" /> Clear filter
            </Button>
          )}
        </div>
      )}

      {view === "entries" && (
        <div className="rounded-lg border bg-card">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState message={t("noData")}>
              <p className="mt-1 text-xs text-muted-foreground">{t("udhaariCreateHint")}</p>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customerName")}</TableHead>
                  <TableHead className="text-right">{t("totalUdhaari")}</TableHead>
                  <TableHead>{t("lastTransaction")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="w-20 text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="font-medium">
                      <span className="flex flex-col">
                        <span>{r.customerName}</span>
                        {r.customerMobile && <span className="text-xs text-muted-foreground">{r.customerMobile}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={r.outstanding > 0 ? "font-semibold text-red-600 tabular-nums" : "text-muted-foreground tabular-nums"}>
                        {formatINR(r.outstanding)}
                      </span>
                      <span className="ml-1 text-[11px] text-muted-foreground">/ {formatINR(r.totalAmount)}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateOnly(r.lastEntryDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={UDHAARI_STATUS_BADGE[r.status] ?? ""}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => void openDetail(r.customerId)} aria-label={t("viewUdhaari")}>
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {view === "entries" && (
        <Pager
          page={page}
          pages={pages}
          onPageChange={setPage}
        />
      )}

      {view === "reminders" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TableSearch value={reminderSearch} onChange={setReminderSearch} />
            <div className="flex gap-1.5 rounded-lg border bg-card p-1">
              {REMINDER_SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setReminderScope(s.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${reminderScope === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t(s.labelKey)}
                  {s.value === "overdue" && reminderCounts.overdue > 0 && (
                    <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{reminderCounts.overdue}</span>
                  )}
                  {s.value === "today" && reminderCounts.today > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{reminderCounts.today}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            {remindersLoading ? (
              <TableSkeleton rows={6} />
            ) : reminders.length === 0 ? (
              <EmptyState message={t("noReminders")}>
                <p className="mt-1 text-xs text-muted-foreground">{t("udhaariCreateHint")}</p>
              </EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customerName")}</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="text-right">{t("totalUdhaari")}</TableHead>
                    <TableHead className="text-right">{t("remaining")}</TableHead>
                    <TableHead>{t("expectedPayDate")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="w-24 text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((r) => (
                    <TableRow key={r.entryId}>
                      <TableCell className="font-medium">
                        <span className="flex flex-col">
                          <span>{r.customerName}</span>
                          {r.customerMobile && <span className="text-xs text-muted-foreground">{r.customerMobile}</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">{r.invoiceNumber ?? "-"}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{formatINR(r.amount)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          r.remaining > 0 ? "font-semibold text-red-600" : "text-muted-foreground",
                        )}
                      >
                        {formatINR(r.remaining)}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs", r.overdue && "font-semibold text-red-600")}>
                          {formatDateOnly(r.dueDate)}
                        </span>
                        {r.overdue && (
                          <span className="ml-1.5">
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600">
                              {t("overdue")} {r.overdueDays}d
                            </Badge>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={UDHAARI_STATUS_BADGE[r.status] ?? ""}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.remaining > 0 && (
                            <Button variant="outline" size="icon" onClick={() => openPay(reminderToEntry(r))} aria-label={t("recordPayment")}>
                              <HandCoins className="size-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => void openDetail(r.customerId)} aria-label={t("viewUdhaari")}>
                            <Eye className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addUdhaariEntry")}</DialogTitle>
            <DialogDescription>{t("udhaariCreateHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("customerName")} *</Label>
              <CustomerNameLookup value={customerName} onChange={onCustomerNameChange} onPick={applyCustomer} />
              {selectedCustomer ? (
                <p className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("usingExistingCustomer")}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="inline-flex items-center gap-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" /> {t("clear")}
                  </button>
                </p>
              ) : (
                customerName.trim().length > 0 && (
                  <p className="text-xs text-muted-foreground">{t("newCustomerHint")}</p>
                )
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("mobileNumber")}</Label>
                <Input
                  value={customerMobile}
                  onChange={(e) => onCustomerMobileChange(e.target.value)}
                  placeholder={t("enterMobile")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("address")}</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={t("address")}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("amount")} *</Label>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("entryDate")}</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("expectedPayDate")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("reminderDate")}</Label>
                <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentStatus")}</Label>
              <div className="flex gap-1.5">
                {(["PENDING", "PAID", "PARTIAL"] as UdhaariStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPayStatus(s)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${payStatus === s ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {payStatus === "PARTIAL" && (
              <div className="space-y-1.5">
                <Label>{t("amountReceived")}</Label>
                <Input type="number" min={0} value={initialPaid} onChange={(e) => setInitialPaid(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("notes")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void submitCreate()} busy={saving} disabled={!customerName.trim() || !Number(amount)}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <HandCoins className="size-4" /> {t("udhaariHistory")} - {detail?.customer.name}
              </span>
            </DialogTitle>
            <DialogDescription>
              {detail?.customer.mobile && ` · ${detail.customer.mobile}`}
              {detail?.customer.address && ` · ${detail.customer.address}`}
              {detail?.customer.gst && ` · GSTIN ${detail.customer.gst}`}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t("totalUdhaari")}</p>
                  <p className="text-lg font-bold tabular-nums">{formatINR(detail.totalAmount)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t("paidAmount")}</p>
                  <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatINR(detail.paidAmount)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t("outstanding")}</p>
                  <p className="text-lg font-bold text-red-600 tabular-nums">{formatINR(detail.outstanding)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {detail.entries.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("noUdhaariEntries")}</p>}
                {detail.entries.map((e) => (
                  <div key={e.id} className="rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold tabular-nums">{formatINR(e.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateOnly(e.entryDate)} · paid {formatINR(e.paid)} · {t("remaining")} {formatINR(e.remaining)}
                        </p>
                        {(e.dueDate || e.invoiceNumber) && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {e.invoiceNumber && <span>Invoice {e.invoiceNumber}</span>}
                            {e.dueDate && <span>{e.invoiceNumber ? " · " : ""}Due {formatDateOnly(e.dueDate)}</span>}
                            {e.reminderDate && <span> · Reminder {formatDateOnly(e.reminderDate)}</span>}
                          </p>
                        )}
                        {e.remaining > 0 && e.dueDate && e.dueDate < todayStr() && (
                          <Badge variant="outline" className="mt-1 border-red-200 bg-red-50 text-red-600">
                            {t("overdue")}
                          </Badge>
                        )}
                        {e.note && <p className="mt-1 text-xs">{e.note}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge variant="outline" className={UDHAARI_STATUS_BADGE[e.status] ?? ""}>
                          {e.status}
                        </Badge>
                        {e.remaining > 0 && (
                          <Button variant="outline" size="sm" onClick={() => openPay(e)}>
                            <Plus className="size-3.5" /> {t("recordPayment")}
                          </Button>
                        )}
                      </div>
                    </div>
                    {e.payments.length > 0 && (
                      <div className="mt-2 border-t pt-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("recordedPayments")}
                        </p>
                        <div className="space-y-1">
                          {e.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {formatDateTime(p.createdAt)} · {p.mode}
                              </span>
                              <span className="font-medium tabular-nums">{formatINR(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recordPayment")}</DialogTitle>
            <DialogDescription>
              {payEntry && payEntry.remaining > 0 ? `${t("remaining")} ${formatINR(payEntry.remaining)}` : undefined}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("amount")} *</Label>
              <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentMode")}</Label>
              <PaymentModeTabs value={payMode} onChange={setPayMode} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("notes")}</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void submitPay()} busy={paying} disabled={!payEntry || !Number(payAmount)}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function UdhaariPage() {
  return (
    <Suspense fallback={null}>
      <UdhaariPageInner />
    </Suspense>
  );
}