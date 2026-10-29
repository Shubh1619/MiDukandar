"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, todayLocalKey } from "@/lib/format";
import type { Supplier, SupplierPaymentMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
import { PendingButton } from "@/components/shared/pending-button";

const MODES: SupplierPaymentMode[] = ["CASH", "UPI", "CARD", "CHEQUE", "NEFT"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSaved: () => void;
}

function today(): string {
  return todayLocalKey();
}

export function PaymentDialog({ open, onOpenChange, supplier, onSaved }: Props) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMode, setPaymentMode] = useState<SupplierPaymentMode>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setAmount("");
    setPaymentDate(today());
    setPaymentMode("CASH");
    setNote("");
  };

  const save = async () => {
    if (!supplier) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setBusy(true);
    try {
      await apiFetch(`/api/suppliers/${supplier.id}/payments`, {
        method: "POST",
        body: { amount: amt, paymentDate, paymentMode, note: note.trim() || undefined },
      });
      toast.success(t("success"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const outstanding = Number(supplier?.outstandingPayable ?? 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recordPayment")}</DialogTitle>
          <DialogDescription>
            {supplier?.name} · {t("outstandingHeader")} {formatINR(outstanding)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{t("amount")} *</Label>
            <NumberInput
              value={amount}
              onChange={(v) => setAmount(v)}
              placeholder="0"
            />
            {Number(amount) > outstanding && (
              <p className="text-[11px] text-red-600">{t("exceedsOutstanding")}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("paymentDate")}</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentMode")}</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as SupplierPaymentMode)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>{t(m.toLowerCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <PendingButton onClick={() => void save()} busy={busy} disabled={Number(amount) <= 0}>
            {t("recordPayment")}
          </PendingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}