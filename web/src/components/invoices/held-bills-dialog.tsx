"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HeldPayload } from "@/components/invoices/invoice-form-dialog";

type HeldBill = {
  id: string;
  bill_number: string;
  payload: HeldPayload;
  created_at: string;
  updated_at: string;
};

interface Props {
  onClose: () => void;
  onResume: (held: { id: string; payload: HeldPayload }) => void;
}

export function HeldBillsDialog({ onClose, onResume }: Props) {
  const { t } = useI18n();
  const [bills, setBills] = useState<HeldBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ heldBills: HeldBill[] }>("/api/sales/held/list");
      setBills(res.heldBills ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/sales/held/${id}`, { method: "DELETE" });
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog defaultOpen onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] w-[96vw] !max-w-none sm:!w-[92vw] sm:!max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("heldBills")}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : bills.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noHeldBills")}</p>
        ) : (
          <ul className="divide-y">
            {bills.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.bill_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.payload?.customer?.name || t("walkIn")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => onResume({ id: b.id, payload: b.payload })}>
                    <Play className="size-4" />
                    {t("resumeBill")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busyId === b.id}
                    onClick={() => remove(b.id)}
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
