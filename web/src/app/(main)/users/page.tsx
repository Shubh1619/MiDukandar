"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Edit2, Loader2, MailPlus, Power, PowerOff, Save, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AppUser, PermissionFlag, PermissionMap, Role, RolePermissions, UserInvite } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileInput } from "@/components/ui/mobile-input";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  STAFF: "Staff",
  STOCK_MANAGER: "Staff",
};

const PERMISSIONS: Array<{ flag: PermissionFlag; label: string }> = [
  { flag: "can_manage_invoices", label: "Invoices" },
  { flag: "can_manage_products", label: "Products" },
  { flag: "can_manage_customers", label: "Customers" },
  { flag: "can_manage_udhaari", label: "Udhaari" },
  { flag: "can_manage_suppliers", label: "Suppliers" },
  { flag: "can_manage_expenses", label: "Expenses" },
  { flag: "can_view_reports", label: "Reports" },
  { flag: "can_manage_settings", label: "Settings" },
  { flag: "can_manage_users", label: "Users" },
];

type InviteForm = { name: string; email: string; phone: string; role: "MANAGER" | "CASHIER" | "STAFF" };
type EditForm = { id: string; name: string; role: Role; status: "active" | "inactive" };

const blankInvite: InviteForm = { name: "", email: "", phone: "", role: "CASHIER" };

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [roles, setRoles] = useState<RolePermissions[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteForm>(blankInvite);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    const [userData, roleData] = await Promise.all([
      apiFetch<{ users: AppUser[]; invites: UserInvite[] }>("/api/users"),
      apiFetch<{ roles: RolePermissions[] }>("/api/roles"),
    ]);
    setUsers(userData.users);
    setInvites(userData.invites);
    setRoles(roleData.roles);
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadAll();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((u) => {
      const haystack = `${u.name} ${u.email} ${u.phone}`.toLowerCase();
      const matchesText = !needle || haystack.includes(needle);
      const matchesRole = roleFilter === "all" || u.role === roleFilter || (roleFilter === "STAFF" && u.role === "STOCK_MANAGER");
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      return matchesText && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const inviteUser = async () => {
    if (!invite.name.trim() || (!invite.email.trim() && !invite.phone.trim())) return;
    setSaving(true);
    try {
      await apiFetch("/api/users/invite", {
        method: "POST",
        body: { name: invite.name.trim(), email: invite.email.trim(), phone: invite.phone.trim(), role: invite.role },
      });
      await loadAll();
      setInvite(blankInvite);
      setInviteOpen(false);
      toast.success("Invite created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to invite user");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await apiFetch(`/api/users/${edit.id}`, {
        method: "PATCH",
        body: { name: edit.name.trim(), role: edit.role, status: edit.status },
      });
      await loadAll();
      setEditOpen(false);
      toast.success("User updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (u: AppUser) => {
    try {
      await apiFetch(`/api/users/${u.id}/status`, { method: "PATCH", body: { status: u.isActive ? "inactive" : "active" } });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    }
  };

  const removeUser = async (u: AppUser) => {
    if (!window.confirm(`Remove ${u.name || u.email}?`)) return;
    try {
      await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
      await loadAll();
      toast.success("User removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove user");
    }
  };

  const updatePermission = (role: Role, flag: PermissionFlag, value: boolean) => {
    setRoles((list) => list.map((r) => (
      r.role === role ? { ...r, permissions: { ...r.permissions, [flag]: value } } : r
    )));
  };

  const saveRole = async (role: Role, permissions: PermissionMap) => {
    setSaving(true);
    try {
      await apiFetch(`/api/roles/${role}`, { method: "PATCH", body: { permissions } });
      await loadAll();
      toast.success(`${ROLE_LABEL[role]} permissions saved`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Users & Roles</h1>
          <p className="text-xs text-muted-foreground">Manage staff accounts and tenant role permissions</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Add User</Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="CASHIER">Cashier</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card">
            {loading ? (
              <TableSkeleton rows={6} />
            ) : filteredUsers.length === 0 ? (
              <EmptyState message="No users found" className="py-8 text-center" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email / Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "Unnamed"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || u.phone || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABEL[u.role] ?? u.role}</Badge></TableCell>
                      <TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{u.lastLogin ? formatDateTime(u.lastLogin) : "Never"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEdit({ id: u.id, name: u.name, role: u.role, status: u.status }); setEditOpen(true); }}><Edit2 className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title={u.isActive ? "Deactivate" : "Activate"} onClick={() => void toggleUser(u)}>{u.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}</Button>
                          <Button variant="ghost" size="icon" title="Remove" onClick={() => void removeUser(u)}><Trash2 className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Pending invites</h2>
            </div>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name || "Invite"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.email || i.phone}</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABEL[i.role] ?? i.role}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(i.expiresAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="rounded-lg border bg-card">
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-36">Role</TableHead>
                    {PERMISSIONS.map((p) => <TableHead key={p.flag} className="text-center">{p.label}</TableHead>)}
                    <TableHead className="text-right">Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.role}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <span className="font-medium">{ROLE_LABEL[role.role] ?? role.role}</span>
                          {role.locked ? <Badge variant="secondary">Fixed</Badge> : null}
                        </div>
                      </TableCell>
                      {PERMISSIONS.map((p) => (
                        <TableCell key={p.flag} className="text-center">
                          <Switch
                            checked={role.permissions[p.flag]}
                            disabled={role.locked}
                            onCheckedChange={(checked) => updatePermission(role.role, p.flag, checked)}
                            aria-label={`${ROLE_LABEL[role.role]} ${p.label}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={role.locked || saving} onClick={() => void saveRole(role.role, role.permissions)}>
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create an invite for a Manager, Cashier or Staff account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={invite.name} onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={invite.email} onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <MobileInput value={invite.phone} onChange={(p) => setInvite((v) => ({ ...v, phone: p }))} />
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
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => void inviteUser()} disabled={saving || !invite.name.trim() || (!invite.email.trim() && !invite.phone.trim())}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />} Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Owner changes are protected so the tenant always keeps one active Owner.</DialogDescription>
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
                      <SelectItem value="OWNER">Owner</SelectItem>
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
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={saving || !edit?.name.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
