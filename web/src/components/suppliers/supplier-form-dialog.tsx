"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import type { Supplier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PendingButton } from "@/components/shared/pending-button";

const empty = { name: "", phone: "", email: "", gstin: "", address: "", category: "" };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supplier | null;
  onSaved: () => void;
}

export function SupplierFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const syncFromEditing = (s: Supplier | null) => {
    setForm(
      s
        ? {
            name: s.name,
            phone: s.phone ?? "",
            email: s.email ?? "",
            gstin: s.gstin ?? "",
            address: s.address ?? "",
            category: s.category ?? "",
          }
        : empty,
    );
  };

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        gstin: form.gstin.trim(),
        address: form.address.trim(),
        category: form.category.trim(),
      };
      if (editing) {
        await apiFetch(`/api/suppliers/${editing.id}`, { method: "PATCH", body });
        toast.success(t("success"));
      } else {
        await apiFetch("/api/suppliers", { method: "POST", body });
        toast.success(t("success"));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) syncFromEditing(editing); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("editSupplier") : t("addSupplier")}</DialogTitle>
          <DialogDescription>{t("supplierFormHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("supplierName")} *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98XXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("gstin")}</Label>
            <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("category")}</Label>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder={t("categoryHint")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("address")}</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <PendingButton onClick={() => void save()} busy={busy} disabled={!form.name.trim()}>
            {t("save")}
          </PendingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}