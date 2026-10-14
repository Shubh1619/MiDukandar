"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import type { ExpenseCategory, ExpensePaymentMode, RecurringExpense } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PendingButton } from "@/components/shared/pending-button";

interface RecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  editing: RecurringExpense | null;
  onSaved: () => void;
}

export function RecurringExpenseDialog({
  open,
  onOpenChange,
  categories,
  editing,
  onSaved,
}: RecurringExpenseDialogProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [nextDueDate, setNextDueDate] = useState(todayStr);
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("CASH");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId || "none");
      setFrequency(editing.frequency || "MONTHLY");
      setNextDueDate(editing.nextDueDate || todayStr);
      setPaymentMode(editing.paymentMode || "CASH");
    } else {
      setTitle("");
      setAmount("");
      setCategoryId(categories.find((c) => c.isDefault)?.id || "none");
      setFrequency("MONTHLY");
      setNextDueDate(todayStr);
      setPaymentMode("CASH");
    }
  }, [editing, open, categories, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!nextDueDate) {
      toast.error("Next due date is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        categoryId: categoryId === "none" ? null : categoryId,
        frequency,
        nextDueDate,
        paymentMode,
      };

      if (editing) {
        await apiFetch(`/api/recurring-expenses/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Recurring expense updated");
      } else {
        await apiFetch("/api/recurring-expenses", {
          method: "POST",
          body: payload,
        });
        toast.success("Recurring expense created");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save recurring expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Recurring Expense" : "Add Recurring Expense"}
          </DialogTitle>
          <DialogDescription>
            Auto-generate expense entries on fixed due dates (e.g. Monthly Rent, Weekly Maintenance).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">Expense Title *</Label>
            <Input
              id="rec-title"
              placeholder="e.g. Monthly Shop Rent, Broadband Bill"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Amount (₹) *</Label>
              <Input
                id="rec-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Frequency *</Label>
              <Select
                value={frequency}
                onValueChange={(val) => setFrequency(val as "MONTHLY" | "WEEKLY")}
              >
                <SelectTrigger id="rec-freq">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-due">Next Due Date *</Label>
              <Input
                id="rec-due"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="rec-cat">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select
              value={paymentMode}
              onValueChange={(val) => setPaymentMode(val as ExpensePaymentMode)}
            >
              <SelectTrigger id="rec-mode">
                <SelectValue placeholder="Select Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI / QR</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="BANK">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <PendingButton type="submit" busy={submitting}>
              {editing ? "Save Changes" : "Create Recurring"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
