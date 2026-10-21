"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, Paperclip, X } from "lucide-react";
import { apiFetch, apiUploadFile, ApiError } from "@/lib/api";
import type { Expense, ExpenseCategory, ExpensePaymentMode } from "@/lib/types";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PendingButton } from "@/components/shared/pending-button";
import { CategoryFormDialog } from "@/components/expenses/category-form-dialog";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  editing: Expense | null;
  onSaved: () => void;
  onCategoryCreated?: (cat: ExpenseCategory) => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  categories,
  editing,
  onSaved,
  onCategoryCreated,
}: ExpenseFormDialogProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [title, setTitle] = useState(editing?.title ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [categoryId, setCategoryId] = useState<string>(
    editing ? editing.categoryId || "none" : categories.find((c) => c.isDefault)?.id || "none",
  );
  const [expenseDate, setExpenseDate] = useState(editing?.expenseDate || todayStr);
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>(editing?.paymentMode || "CASH");
  const [note, setNote] = useState(editing?.note || "");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(editing?.attachmentUrl || null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await apiUploadFile<{ url: string }>("/api/uploads/image?entity=expenses", file);
      if (res.url) {
        setAttachmentUrl(res.url);
        toast.success("Receipt attached successfully");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload receipt");
    } finally {
      setUploading(false);
    }
  };

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
    if (expenseDate > todayStr) {
      toast.error("Expense date cannot be in the future");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        amount: numAmount,
        categoryId: categoryId === "none" ? null : categoryId,
        expenseDate,
        paymentMode,
        note: note.trim() || undefined,
        attachmentUrl: attachmentUrl || null,
      };

      if (editing) {
        await apiFetch(`/api/expenses/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Expense updated");
      } else {
        await apiFetch("/api/expenses", {
          method: "POST",
          body: payload,
        });
        toast.success("Expense recorded");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Record New Expense"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update expense details below."
                : "Record store expenses, bills, salary, or transport costs."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Expense Title *</Label>
              <Input
                id="exp-title"
                placeholder="e.g. Shop Rent Sept, Electricity Bill, Tea & Snacks"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Amount (₹) *</Label>
                <NumberInput
                  id="exp-amount"
                  placeholder="0.00"
                  value={amount}
                  onChange={(v) => setAmount(v)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  max={todayStr}
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <button
                    type="button"
                    onClick={() => setAddCatOpen(true)}
                    className="flex items-center gap-0.5 text-xs text-primary font-medium hover:underline"
                  >
                    <Plus className="size-3" /> Add New
                  </button>
                </div>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="exp-category">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.isDefault ? "" : "(Custom)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={(val) => setPaymentMode(val as ExpensePaymentMode)}
                >
                  <SelectTrigger id="exp-payment-mode">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-note">Note / Remarks (Optional)</Label>
              <Textarea
                id="exp-note"
                placeholder="Additional details, bill numbers, receiver name..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Attach Bill Photo */}
            <div className="space-y-1.5">
              <Label>Bill Photo / Receipt Attachment (Optional)</Label>
              {attachmentUrl ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="size-4 text-primary shrink-0" />
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-primary underline"
                    >
                      View Receipt Attachment
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => setAttachmentUrl(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    <Upload className="size-4" />
                    <span>{uploading ? "Uploading..." : "Upload Receipt Image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleFileUpload(e)}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <PendingButton type="submit" busy={submitting || uploading}>
                {editing ? "Save Changes" : "Record Expense"}
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CategoryFormDialog
        open={addCatOpen}
        onOpenChange={setAddCatOpen}
        onCreated={(newCat) => {
          setCategoryId(newCat.id);
          onCategoryCreated?.(newCat);
        }}
      />
    </>
  );
}
