"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import { PAYMENT_TYPE_BADGE } from "@/lib/badges";
import type { Payment, Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { PaymentModeTabs } from "@/components/shared/payment-mode-tabs";
import { PendingButton } from "@/components/shared/pending-button";

export default function PaymentsPage() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ payments: Payment[]; total: number }>(
        `/api/payments?page=${page}&limit=${limit}`,
      );
      setPayments(data.payments);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReceive = async () => {
    setReceiveOpen(true);
    setCustomerId("");
    setAmount("");
    setNote("");
    try {
      const data = await apiFetch<{ customers: Customer[] }>("/api/customers?limit=200");
      setCustomers(data.customers.filter((c) => Number(c.outstanding) > 0));
    } catch {
      setCustomers([]);
    }
  };

  const submit = async () => {
    if (!customerId || !Number(amount)) return;
    setSaving(true);
    try {
      await apiFetch("/api/payments/receive", {
        method: "POST",
        body: { customerId, amount: Number(amount), mode, note },
      });
      toast.success("Payment received");
      setReceiveOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("navPayments")}</h1>
          <p className="text-xs text-muted-foreground">{total} payment(s)</p>
        </div>
        <Button onClick={() => void openReceive()}>
          <Wallet className="size-4" /> {t("payReceive")}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : payments.length === 0 ? (
          <EmptyState message={t("noData")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("customer")}</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell className="font-medium">{p.customerName ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PAYMENT_TYPE_BADGE[p.type] ?? ""}>
                      {p.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.mode}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {p.type === "RECEIVED" ? `+${formatINR(p.amount)}` : formatINR(p.amount)}
                  </TableCell>
                  <TableCell className="max-w-52 truncate text-xs text-muted-foreground">{p.note ?? "-"}</TableCell>
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

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payReceive")}</DialogTitle>
            <DialogDescription>Record payment received from a customer (reduces udhaari).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("customer")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {formatINR(c.outstanding)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("amount")}</Label>
              <NumberInput value={amount} onChange={(v) => setAmount(v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <PaymentModeTabs value={mode} onChange={setMode} />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void submit()} busy={saving} disabled={!customerId || !Number(amount)}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}