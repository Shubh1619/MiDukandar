"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Edit2, ExternalLink, FileText, Loader2, MailPlus, MessageCircle, Phone, Power, PowerOff, RotateCw, Scale, Trash2, UserPlus, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { useAuth } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/format";
import type { AppUser, Role, Store, UserInvite } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

const LANGUAGES = [
  { code: "en", label: "English", short: "ENG" },
  { code: "hi", label: "Hindi", short: "Hindi" },
  { code: "mr", label: "Marathi", short: "Marathi" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  STAFF: "Staff",
  STOCK_MANAGER: "Staff",
};

type InviteForm = { name: string; email: string; phone: string; role: "MANAGER" | "CASHIER" | "STAFF" };
type EditForm = { id: string; name: string; role: Role; status: "active" | "inactive" };

const blankInvite: InviteForm = { name: "", email: "", phone: "", role: "CASHIER" };

export default function SettingsPage() {
  const { t, setLocale } = useI18n();
  const setAuthStore = useAuth((s) => s.setStore);
  const [store, setStoreState] = useState<Store | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "", address: "", city: "", state: "", pincode: "",
    phone: "", gst: "", currency: "INR", language: "hi", invoicePrefix: "INV",
  });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteForm>(blankInvite);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [referral, setReferral] = useState<{
    code: string;
    shareUrl: string;
    referredCount: number;
    referrals: { storeName: string; createdAt: string }[];
  } | null>(null);
  const [refApplyCode, setRefApplyCode] = useState("");
  const [refBusy, setRefBusy] = useState(false);

  const staff = useMemo(() => users.filter((u) => u.role !== "OWNER"), [users]);

  const loadReferral = async () => {
    try {
      const data = await apiFetch<{
        code: string;
        shareUrl: string;
        referredCount: number;
        referrals: { storeName: string; createdAt: string }[];
      }>("/api/referral");
      setReferral(data);
    } catch {
      // Non-owner staff cannot view referrals; ignore.
    }
  };

  const loadUsers = async () => {
    const data = await apiFetch<{ users: AppUser[]; invites: UserInvite[] }>("/api/users");
    setUsers(data.users);
    setInvites(data.invites);
  };

  useEffect(() => {
    void (async () => {
      try {
        const [storeData] = await Promise.all([apiFetch<{ store: Store }>("/api/store"), loadUsers()]);
        void loadReferral();
        const s = storeData.store;
        setStoreState(s);
        setForm({
          name: s.name, type: s.type, address: s.address ?? "", city: s.city ?? "",
          state: s.state ?? "", pincode: s.pincode ?? "", phone: s.phone ?? "",
          gst: s.gst ?? "", currency: s.currency ?? "INR", language: s.language ?? "hi",
          invoicePrefix: s.invoicePrefix ?? "INV",
        });
        if (s.language) setLocale(s.language as "en" | "hi" | "mr");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load settings");
      } finally {
        setStoreLoading(false);
        setStaffLoading(false);
      }
    })();
  }, [setLocale]);

  const saveStore = async () => {
    setSavingStore(true);
    try {
      const data = await apiFetch<{ store: Store }>("/api/store", {
        method: "PUT",
        body: {
          name: form.name,
          type: form.type,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          phone: form.phone,
          gst: form.gst,
          currency: form.currency,
          language: form.language,
          invoicePrefix: form.invoicePrefix,
        },
      });
      setStoreState(data.store);
      setAuthStore(data.store);
      setLocale(form.language as "en" | "hi" | "mr");
      toast.success("Store updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSavingStore(false);
    }
  };

  const saveLanguage = async (language: "en" | "hi" | "mr") => {
    setSavingLanguage(true);
    setForm((f) => ({ ...f, language }));
    setLocale(language);
    try {
      const data = await apiFetch<{ store: Store }>("/api/settings/language", { method: "PATCH", body: { language } });
      setStoreState(data.store);
      setAuthStore(data.store);
      toast.success("Language saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save language");
    } finally {
      setSavingLanguage(false);
    }
  };

  const inviteStaff = async () => {
    if (!invite.name.trim() || !invite.email.trim()) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ inviteLink?: string }>("/api/users/invite", {
        method: "POST",
        body: { name: invite.name.trim(), email: invite.email.trim(), phone: invite.phone.trim(), role: invite.role },
      });
      await loadUsers();
      setInviteOpen(false);
      setInvite(blankInvite);
      if (created.inviteLink) {
        const absolute = created.inviteLink.startsWith("http")
          ? created.inviteLink
          : `${window.location.origin}${created.inviteLink}`;
        toast.success("Invite created", {
          action: {
            label: "Copy link",
            onClick: () => {
              void navigator.clipboard.writeText(absolute).then(
                () => toast.success("Invite link copied"),
                () => toast.error("Could not copy the invite link"),
              );
            },
          },
        });
      } else {
        toast.success("Invite created");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to invite staff");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await apiFetch(`/api/users/${edit.id}`, {
        method: "PATCH",
        body: { name: edit.name.trim(), role: edit.role, status: edit.status },
      });
      await loadUsers();
      setEditOpen(false);
      toast.success("Staff updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update staff");
    } finally {
      setBusy(false);
    }
  };

  const toggleUser = async (u: AppUser) => {
    try {
      await apiFetch(`/api/users/${u.id}/status`, { method: "PATCH", body: { status: u.isActive ? "inactive" : "active" } });
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    }
  };

  const removeUser = async (u: AppUser) => {
    if (!window.confirm(`Remove ${u.name || u.email}?`)) return;
    try {
      await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
      await loadUsers();
      toast.success("Staff removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove staff");
    }
  };

  const resendInvite = async (id: string) => {
    try {
      await apiFetch(`/api/users/invite/${id}/resend`, { method: "POST" });
      await loadUsers();
      toast.success("Invite refreshed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resend invite");
    }
  };

  const cancelInvite = async (id: string) => {
    try {
      await apiFetch(`/api/users/invite/${id}`, { method: "DELETE" });
      await loadUsers();
      toast.success("Invite cancelled");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to cancel invite");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold">{t("navSettings")}</h1>
        <p className="text-xs text-muted-foreground">Store profile, staff access and tenant language</p>
      </div>

      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">{t("storeDetails")}</TabsTrigger>
          <TabsTrigger value="staff">{t("staff")}</TabsTrigger>
          <TabsTrigger value="language">{t("language")}</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="referral">Refer</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <div className="max-w-2xl space-y-3 rounded-lg border bg-card p-4">
            {storeLoading ? (
              <TableSkeleton rows={6} padded={false} />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("storeName")} *</Label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type *</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["GENERAL_STORE", "SUPERMARKET", "SERVICES", "RETAIL", "OTHER"].map((o) => (
                          <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("paymentPhone")}</Label>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GST</Label>
                    <Input value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t("address")}</Label>
                    <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("city")}</Label>
                    <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("state")}</Label>
                    <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pincode</Label>
                    <Input value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("invoicePrefix")}</Label>
                    <Input value={form.invoicePrefix} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => void saveStore()} disabled={savingStore || !form.name.trim() || !form.type.trim()} className="self-start">
                  {savingStore ? <Loader2 className="size-4 animate-spin" /> : null} {t("save")}
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="staff">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{staff.length} staff member(s)</p>
              <Button onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite Staff</Button>
            </div>
            <div className="rounded-lg border bg-card">
              {staffLoading ? (
                <TableSkeleton rows={4} />
              ) : staff.length === 0 ? (
                <EmptyState message={t("noData")} className="py-8 text-center" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email / Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name || "Unnamed"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.email || s.phone || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{ROLE_LABEL[s.role] ?? s.role}</Badge></TableCell>
                        <TableCell><Badge variant={s.isActive ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{s.lastLogin ? formatDateTime(s.lastLogin) : "Never"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEdit({ id: s.id, name: s.name, role: s.role, status: s.status }); setEditOpen(true); }}><Edit2 className="size-4" /></Button>
                            <Button variant="ghost" size="icon" title={s.isActive ? "Deactivate" : "Activate"} onClick={() => void toggleUser(s)}>{s.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}</Button>
                            <Button variant="ghost" size="icon" title="Remove" onClick={() => void removeUser(s)}><Trash2 className="size-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Pending invites</h2>
              <div className="rounded-lg border bg-card">
                {invites.length === 0 ? (
                  <EmptyState message="No pending invites" className="py-6 text-center" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email / Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.name || "Invite"}</TableCell>
                          <TableCell className="text-muted-foreground">{i.email || i.phone}</TableCell>
                          <TableCell><Badge variant="outline">{ROLE_LABEL[i.role] ?? i.role}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(i.expiresAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => void resendInvite(i.id)}><RotateCw className="size-4" /> Resend</Button>
                            <Button variant="ghost" size="sm" onClick={() => void cancelInvite(i.id)}><X className="size-4" /> Cancel</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="language">
          <div className="max-w-xl space-y-3 rounded-lg border bg-card p-4">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => void saveLanguage(lang.code)}
                disabled={savingLanguage}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium ${form.language === lang.code ? "border-primary bg-primary/5" : "bg-background"}`}
              >
                <span>
                  <span className="block">{lang.label}</span>
                  <span className="text-xs text-muted-foreground">{lang.short}</span>
                </span>
                {form.language === lang.code && <Badge variant="outline" className="border-primary text-primary">Selected</Badge>}
              </button>
            ))}
            {store ? <p className="pt-1 text-xs text-muted-foreground">This tenant default syncs with the language toggle in the header.</p> : null}
          </div>
        </TabsContent>

        <TabsContent value="legal">
          <div className="max-w-2xl space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-royal-600">
                  <Scale className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold">Legal &amp; account policies</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Review the terms that apply when you use MiDukandar.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/terms" className="group flex items-center justify-between rounded-xl border bg-background p-4 transition-colors hover:border-royal-300 hover:bg-royal-50/50">
                  <span className="flex items-center gap-3">
                    <FileText className="size-4 text-royal-600" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold">Terms of Service</span>
                      <span className="block text-xs text-muted-foreground">Usage, billing and liability</span>
                    </span>
                  </span>
                  <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link href="/pricing" className="group flex items-center justify-between rounded-xl border bg-background p-4 transition-colors hover:border-royal-300 hover:bg-royal-50/50">
                  <span className="flex items-center gap-3">
                    <span className="flex size-4 items-center justify-center text-royal-600"><span className="text-base font-bold leading-none">₹</span></span>
                    <span>
                      <span className="block text-sm font-semibold">Plans &amp; pricing</span>
                      <span className="block text-xs text-muted-foreground">Free, Pro and Enterprise</span>
                    </span>
                  </span>
                  <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Questions or data requests?</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Contact the support team for account, billing, or data questions.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="mailto:support@midukandar.com"><MessageCircle className="size-4" /> Email support</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="tel:18006393852"><Phone className="size-4" /> 1800-MI-DUKAN</a>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="referral">
          <div className="max-w-2xl space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-royal-600">
                  <UserPlus className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold">Refer a friend</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Share your code. When a shop signs up with it, they are linked to your account.
                  </p>
                </div>
              </div>
              {referral ? (
                <div className="mt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Your referral code</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={referral.code} className="font-display text-lg font-bold tracking-widest" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(referral.code);
                          toast.success("Referral code copied");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Share link</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={referral.shareUrl} />
                      <Button
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(referral.shareUrl);
                          toast.success("Referral link copied");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {referral.referredCount} shop{referral.referredCount === 1 ? "" : "s"} referred
                  </p>
                  {referral.referrals.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                      {referral.referrals.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="truncate font-medium">{r.storeName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Only the shop owner can view the referral program.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-display text-base font-bold">Have a code?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter a friend's referral code to link your shop.</p>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="e.g. A1B2C3D4"
                  value={refApplyCode}
                  onChange={(e) => setRefApplyCode(e.target.value.toUpperCase())}
                />
                <Button
                  disabled={refBusy || refApplyCode.trim().length < 4}
                  onClick={async () => {
                    setRefBusy(true);
                    try {
                      await apiFetch("/api/referral/apply", {
                        method: "POST",
                        body: { code: refApplyCode.trim() },
                      });
                      toast.success("Referral code applied");
                      setRefApplyCode("");
                      void loadReferral();
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : "Could not apply code");
                    } finally {
                      setRefBusy(false);
                    }
                  }}
                >
                  {refBusy ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Staff</DialogTitle>
            <DialogDescription>Send an invite with a role. They can accept it and finish account setup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={invite.phone} onChange={(e) => setInvite((v) => ({ ...v, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite((f) => ({ ...f, role: v as InviteForm["role"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => void inviteStaff()} disabled={busy || !invite.name.trim() || !invite.email.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />} Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
            <DialogDescription>Role and status changes apply on the next request.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={edit.name} onChange={(e) => setEdit((v) => v ? { ...v, name: e.target.value } : v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={edit.role} onValueChange={(v) => setEdit((f) => f ? { ...f, role: v as Role } : f)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={edit.status} onValueChange={(v) => setEdit((f) => f ? { ...f, status: v as "active" | "inactive" } : f)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => void saveEdit()} disabled={busy || !edit?.name.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
