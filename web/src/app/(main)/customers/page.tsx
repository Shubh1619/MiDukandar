"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2, HandCoins, Loader2, Upload } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR, formatDateTime } from "@/lib/format";
import { LEDGER_TYPE_BADGE } from "@/lib/badges";
import type { Customer, LedgerEntry, Sale } from "@/lib/types";
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
import { PendingButton } from "@/components/shared/pending-button";

interface CustomerDetail {
  customer: Customer;
  ledger: LedgerEntry[];
  sales: Sale[];
}

const emptyForm = { name: "", mobile: "", address: "", gst: "" };

export default function CustomersPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<{ customers: Customer[]; total: number }>(`/api/customers?${params}`);
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, mobile: c.mobile ?? "", address: c.address ?? "", gst: c.gst ?? "" });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { name: form.name.trim(), mobile: form.mobile, address: form.address, gst: form.gst };
      if (editing) {
        await apiFetch(`/api/customers/${editing.id}`, { method: "PUT", body });
        toast.success("Customer updated");
      } else {
        await apiFetch("/api/customers", { method: "POST", body });
        toast.success("Customer added");
      }
      setFormOpen(false);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/customers/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Customer deleted");
      if (detail?.customer.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  };

  const viewDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await apiFetch<CustomerDetail>(`/api/customers/${id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load customer");
    } finally {
      setDetailLoading(false);
    }
  };

  const parseVCard = (text: string) => {
    const cards = text.split(/END:VCARD/i);
    const results: Array<{ name: string; mobile?: string }> = [];
    for (const card of cards) {
      if (!/BEGIN:VCARD/i.test(card)) continue;
      let name = "";
      let mobile = "";
      const nameMatch = card.match(/FN[^:\r\n]*:(.*)/i) || card.match(/N[^:\r\n]*:(.*)/i);
      if (nameMatch) {
        name = nameMatch[1].replace(/;/g, " ").replace(/\\/g, "").trim();
      }
      const telMatch = card.match(/TEL[^:\r\n]*:(.*)/i);
      if (telMatch) {
        mobile = telMatch[1].replace(/[^0-9+]/g, "").trim();
      }
      if (name) results.push({ name, mobile: mobile || undefined });
    }
    return results;
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const results: Array<{ name: string; mobile?: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.replace(/^"|"$/g, "").trim());
      if (i === 0) {
        const lower = parts.map((p) => p.toLowerCase());
        if (lower.includes("name") || lower.includes("mobile") || lower.includes("phone") || lower.includes("number")) continue;
      }
      const name = parts[0] || parts[1] || "";
      const mobile = (parts[1] || parts[2] || "").replace(/[^0-9+]/g, "");
      if (name) results.push({ name, mobile: mobile || undefined });
    }
    return results;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let items: Array<{ name: string; mobile?: string }> = [];
      if (file.name.toLowerCase().endsWith(".vcf") || /BEGIN:VCARD/i.test(text)) {
        items = parseVCard(text);
      } else if (file.name.toLowerCase().endsWith(".csv") || text.includes(",")) {
        items = parseCsv(text);
      } else {
        toast.error("Unsupported file. Upload .vcf or .csv");
        return;
      }
      let added = 0;
      for (const item of items) {
        if (!item.name.trim()) continue;
        try {
          await apiFetch("/api/customers", { method: "POST", body: { name: item.name.trim(), mobile: item.mobile || "" } });
          added++;
        } catch {
          // skip duplicates/errors
        }
      }
      toast.success(`Imported ${added} customer(s)`);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to import");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("navCustomers")}</h1>
          <p className="text-xs text-muted-foreground">{t("customerCount", { count: total })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".vcf,.csv,text/vcard,text/csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import vCard/CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus className="size-4" /> {t("addCustomer")}
          </Button>
        </div>
      </div>

      <TableSearch value={search} onChange={(v) => { setSearch(v); setPage(1); }} />

      <div className="rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : customers.length === 0 ? (
          <EmptyState message={t("noData")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customerName")}</TableHead>
                <TableHead>{t("mobile")}</TableHead>
                <TableHead>{t("gstin")}</TableHead>
                <TableHead className="w-40 text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.mobile ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.gst ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => void viewDetail(c.id)} title={t("viewDetails")} aria-label={t("viewDetails")}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title={t("edit")} aria-label={t("edit")}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} title={t("delete")} aria-label={t("delete")}>
                        <Trash2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/udhaari?customerId=${c.id}`)} title={t("viewUdhaari")} aria-label={t("viewUdhaari")}>
                        <HandCoins className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("editCustomer") : t("addCustomer")}</DialogTitle>
            <DialogDescription>Maintain customer master records. Udhaari entries are managed from the Udhaari page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("customerName")} *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("mobile")}</Label>
              <Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("gstin")}</Label>
              <Input value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("address")}</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("cancel")}</Button>
            <PendingButton onClick={() => void submitForm()} busy={saving} disabled={!form.name.trim()}>
              {t("save")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailLoading || !!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.customer.name}</DialogTitle>
            <DialogDescription>
              {detail?.customer.mobile && ` · ${detail.customer.mobile}`}
              {detail?.customer.gst && ` · GSTIN ${detail.customer.gst}`}
              {detail?.customer.address && ` · ${detail.customer.address}`}
              {detail && Number(detail.customer.outstanding) > 0 && ` · Outstanding ${formatINR(detail.customer.outstanding)}`}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => router.push(`/udhaari?customerId=${detail.customer.id}`)}>
                  <HandCoins className="size-4" /> {t("viewUdhaari")}
                </Button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent sales</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead className="text-right">{t("amount")}</TableHead>
                        <TableHead className="text-right">{t("due")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.sales.length === 0 && (
                        <TableRow><TableCell className="py-6 text-center text-muted-foreground" colSpan={4}>{t("noData")}</TableCell></TableRow>
                      )}
                      {detail.sales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.invoiceNumber}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(s.total)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${Number(s.dueAmount) > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {formatINR(s.dueAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("ledger")}</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">{t("amount")}</TableHead>
                        <TableHead className="text-right">{t("balanceAfter")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.ledger.length === 0 && (
                        <TableRow><TableCell className="py-6 text-center text-muted-foreground" colSpan={4}>{t("noData")}</TableCell></TableRow>
                      )}
                      {detail.ledger.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={LEDGER_TYPE_BADGE[e.type] ?? ""}>
                              {e.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(e.amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{e.balanceAfter != null ? formatINR(e.balanceAfter) : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteCustomer")}</DialogTitle>
            <DialogDescription>
              {t("confirmDelete")} {deleteTarget?.name}. {t("actionCannotBeUndone")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <PendingButton variant="destructive" onClick={() => void confirmDelete()} busy={deleting}>
              {t("delete")}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}