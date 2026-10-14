"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2, Paperclip, RefreshCw, Calendar, Tag, Wallet } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatINR, formatDateTime } from "@/lib/format";
import type { Expense, ExpenseCategory, ExpenseSummary, RecurringExpense } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSearch } from "@/components/shared/table-search";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Pager } from "@/components/shared/pager";
import { PendingButton } from "@/components/shared/pending-button";
import { ExpenseSummaryBar } from "@/components/expenses/expense-summary-bar";
import { ExpenseCategoryChart } from "@/components/expenses/expense-category-chart";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseDetailDialog } from "@/components/expenses/expense-detail-dialog";
import { RecurringExpenseDialog } from "@/components/expenses/recurring-expense-dialog";

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<"onetime" | "recurring">("onetime");

  // Summary & Categories
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "month">("month");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Recurring state
  const [recurringList, setRecurringList] = useState<RecurringExpense[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

  // Dialog states
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editExpenseTarget, setEditExpenseTarget] = useState<Expense | null>(null);
  const [viewExpenseTarget, setViewExpenseTarget] = useState<Expense | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);

  const [addRecurringOpen, setAddRecurringOpen] = useState(false);
  const [editRecurringTarget, setEditRecurringTarget] = useState<RecurringExpense | null>(null);
  const [deleteRecurringTarget, setDeleteRecurringTarget] = useState<RecurringExpense | null>(null);

  const [deleting, setDeleting] = useState(false);

  // Load summary stats
  const loadSummary = useCallback(async () => {
    try {
      const data = await apiFetch<ExpenseSummary>("/api/expenses/summary");
      setSummary(data);
    } catch {
      // Non-critical error
    }
  }, []);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch<{ categories: ExpenseCategory[] }>("/api/expense-categories/categories");
      setCategories(res.categories);
    } catch {
      // Non-critical error
    }
  }, []);

  // Load expenses list
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (selectedCategory !== "all") params.set("categoryId", selectedCategory);
      if (selectedPaymentMode !== "all") params.set("paymentMode", selectedPaymentMode);

      const todayStr = new Date().toISOString().split("T")[0];
      if (datePreset === "today") {
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (datePreset === "month") {
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        params.set("from", startMonth);
        params.set("to", todayStr);
      }

      const data = await apiFetch<{ expenses: Expense[]; total: number }>(`/api/expenses?${params}`);
      setExpenses(data.expenses);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedPaymentMode, datePreset, page]);

  // Load recurring list
  const loadRecurring = useCallback(async () => {
    setRecurringLoading(true);
    try {
      const res = await apiFetch<{ recurring: RecurringExpense[] }>("/api/recurring-expenses/recurring");
      setRecurringList(res.recurring);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load recurring expenses");
    } finally {
      setRecurringLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadCategories();
  }, [loadSummary, loadCategories]);

  useEffect(() => {
    if (activeTab === "onetime") {
      void loadExpenses();
    } else {
      void loadRecurring();
    }
  }, [activeTab, loadExpenses, loadRecurring]);

  // Delete expense handler
  const confirmDeleteExpense = async () => {
    if (!deleteExpenseTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/expenses/${deleteExpenseTarget.id}`, { method: "DELETE" });
      toast.success("Expense deleted");
      setDeleteExpenseTarget(null);
      void loadExpenses();
      void loadSummary();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  };

  // Delete recurring handler
  const confirmDeleteRecurring = async () => {
    if (!deleteRecurringTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/recurring-expenses/${deleteRecurringTarget.id}`, { method: "DELETE" });
      toast.success("Recurring expense deleted");
      setDeleteRecurringTarget(null);
      void loadRecurring();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete recurring expense");
    } finally {
      setDeleting(false);
    }
  };

  // Toggle active recurring status
  const toggleRecurringActive = async (item: RecurringExpense, nextState: boolean) => {
    try {
      await apiFetch(`/api/recurring-expenses/${item.id}`, {
        method: "PATCH",
        body: { isActive: nextState },
      });
      toast.success(`Recurring expense ${nextState ? "activated" : "paused"}`);
      void loadRecurring();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    }
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <Wallet className="size-5 text-primary" /> Expenses
          </h1>
          <p className="text-xs text-muted-foreground">
            Track daily store costs, vendor bills, and recurring business expenses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "recurring" ? (
            <Button onClick={() => setAddRecurringOpen(true)}>
              <Plus className="size-4" /> Add Recurring Expense
            </Button>
          ) : (
            <Button onClick={() => setAddExpenseOpen(true)}>
              <Plus className="size-4" /> Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <ExpenseSummaryBar summary={summary} />

      {/* Navigation Tabs */}
      <div className="flex items-center border-b text-sm font-medium">
        <button
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "onetime"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("onetime")}
        >
          <Calendar className="size-4" /> One-time Expenses ({total})
        </button>
        <button
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "recurring"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("recurring")}
        >
          <RefreshCw className="size-4" /> Recurring Expenses ({recurringList.length})
        </button>
      </div>

      {/* TAB 1: ONE-TIME EXPENSES */}
      {activeTab === "onetime" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* Category Breakdown (1 col) */}
            <div className="lg:col-span-1">
              <ExpenseCategoryChart
                categories={summary?.categoryBreakdown ?? []}
                totalThisMonth={summary?.thisMonthTotal ?? 0}
              />
            </div>

            {/* Expenses List & Filters (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2 bg-card p-2.5 rounded-lg border">
                <div className="flex-1 min-w-[180px]">
                  <TableSearch
                    value={search}
                    onChange={(v: string) => {
                      setSearch(v);
                      setPage(1);
                    }}
                  />
                </div>

                <Select
                  value={selectedCategory}
                  onValueChange={(v) => {
                    setSelectedCategory(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedPaymentMode}
                  onValueChange={(v) => {
                    setSelectedPaymentMode(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-32 h-9 text-xs">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / QR</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="BANK">Bank</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1 border rounded-md p-1 bg-background text-xs">
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      datePreset === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => { setDatePreset("month"); setPage(1); }}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      datePreset === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => { setDatePreset("today"); setPage(1); }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      datePreset === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => { setDatePreset("all"); setPage(1); }}
                  >
                    All Time
                  </button>
                </div>
              </div>

              {/* Expenses Table */}
              <div className="rounded-lg border bg-card">
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : expenses.length === 0 ? (
                  <EmptyState message="No expenses found. Click '+ Add Expense' to record one." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-center">Receipt</TableHead>
                        <TableHead className="w-28 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {exp.expenseDate}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            <button
                              type="button"
                              onClick={() => setViewExpenseTarget(exp)}
                              className="hover:underline text-left"
                            >
                              {exp.title}
                            </button>
                            {exp.note && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-xs font-normal">
                                {exp.note}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[11px]">
                              {exp.categoryName || "Uncategorized"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-foreground">
                            {formatINR(exp.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {exp.paymentMode}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {exp.attachmentUrl ? (
                              <a
                                href={exp.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View Receipt"
                                className="inline-flex items-center justify-center p-1 rounded bg-royal-50 text-royal-600 hover:bg-royal-100"
                              >
                                <Paperclip className="size-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewExpenseTarget(exp)}
                                title="View Details"
                              >
                                <Eye className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditExpenseTarget(exp)}
                                title="Edit"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteExpenseTarget(exp)}
                                title="Delete"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Pager page={page} pages={pages} onPageChange={setPage} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECURRING EXPENSES */}
      {activeTab === "recurring" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card">
            {recurringLoading ? (
              <TableSkeleton rows={5} />
            ) : recurringList.length === 0 ? (
              <EmptyState message="No recurring expenses configured. Click '+ Add Recurring Expense' to automate bills." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due Date</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringList.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-semibold text-foreground">{rec.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {rec.categoryName || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatINR(rec.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {rec.frequency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {rec.nextDueDate}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rec.paymentMode}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={rec.isActive}
                            onCheckedChange={(checked) => void toggleRecurringActive(rec, checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {rec.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditRecurringTarget(rec)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteRecurringTarget(rec)}
                            title="Delete"
                          >
                            <Trash2 className="size-4 text-destructive" />
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

      {/* Dialogs */}
      <ExpenseFormDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        categories={categories}
        editing={null}
        onSaved={() => {
          void loadExpenses();
          void loadSummary();
        }}
        onCategoryCreated={() => void loadCategories()}
      />

      <ExpenseFormDialog
        open={!!editExpenseTarget}
        onOpenChange={(o) => !o && setEditExpenseTarget(null)}
        categories={categories}
        editing={editExpenseTarget}
        onSaved={() => {
          setEditExpenseTarget(null);
          void loadExpenses();
          void loadSummary();
        }}
        onCategoryCreated={() => void loadCategories()}
      />

      <ExpenseDetailDialog
        open={!!viewExpenseTarget}
        onOpenChange={(o) => !o && setViewExpenseTarget(null)}
        expense={viewExpenseTarget}
        onEdit={(exp) => setEditExpenseTarget(exp)}
        onDelete={(exp) => setDeleteExpenseTarget(exp)}
      />

      <RecurringExpenseDialog
        open={addRecurringOpen}
        onOpenChange={setAddRecurringOpen}
        categories={categories}
        editing={null}
        onSaved={() => void loadRecurring()}
      />

      <RecurringExpenseDialog
        open={!!editRecurringTarget}
        onOpenChange={(o) => !o && setEditRecurringTarget(null)}
        categories={categories}
        editing={editRecurringTarget}
        onSaved={() => {
          setEditRecurringTarget(null);
          void loadRecurring();
        }}
      />

      {/* Delete Expense Confirmation */}
      <Dialog open={!!deleteExpenseTarget} onOpenChange={(o) => !o && setDeleteExpenseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete expense &quot;{deleteExpenseTarget?.title}&quot; (
              {formatINR(deleteExpenseTarget?.amount ?? 0)})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExpenseTarget(null)}>
              Cancel
            </Button>
            <PendingButton variant="destructive" onClick={() => void confirmDeleteExpense()} busy={deleting}>
              Delete
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Recurring Confirmation */}
      <Dialog open={!!deleteRecurringTarget} onOpenChange={(o) => !o && setDeleteRecurringTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recurring Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete recurring expense &quot;{deleteRecurringTarget?.title}&quot;?
              Auto-generation of this bill will stop.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecurringTarget(null)}>
              Cancel
            </Button>
            <PendingButton variant="destructive" onClick={() => void confirmDeleteRecurring()} busy={deleting}>
              Delete
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}