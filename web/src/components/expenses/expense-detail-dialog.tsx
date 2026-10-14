"use client";

import { Eye, ExternalLink, Pencil, Trash2, Calendar, Tag, CreditCard, FileText } from "lucide-react";
import { formatINR, formatDateTime } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ExpenseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export function ExpenseDetailDialog({
  open,
  onOpenChange,
  expense,
  onEdit,
  onDelete,
}: ExpenseDetailDialogProps) {
  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between pr-4">
            <div>
              <DialogTitle className="text-lg font-bold">{expense.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Recorded on {expense.expenseDate}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-semibold">
              {expense.categoryName || "Uncategorized"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount banner */}
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">
              {formatINR(expense.amount)}
            </p>
          </div>

          {/* Details list */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
              <Calendar className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Expense Date</p>
                <p className="font-semibold text-foreground">{expense.expenseDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
              <CreditCard className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Payment Mode</p>
                <p className="font-semibold text-foreground">{expense.paymentMode}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
              <Tag className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Category</p>
                <p className="font-semibold text-foreground">
                  {expense.categoryName || "Uncategorized"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Created At</p>
                <p className="font-semibold text-foreground">{formatDateTime(expense.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Note */}
          {expense.note && (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground">Notes / Remarks</p>
              <p className="text-foreground whitespace-pre-wrap">{expense.note}</p>
            </div>
          )}

          {/* Attachment Preview */}
          {expense.attachmentUrl && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Receipt Photo / Attachment</span>
                <a
                  href={expense.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Open Original <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="relative overflow-hidden rounded-md border bg-black/5 max-h-56 flex justify-center">
                <img
                  src={expense.attachmentUrl}
                  alt="Bill attachment"
                  className="max-h-56 w-auto object-contain"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onDelete(expense);
            }}
          >
            <Trash2 className="size-4 mr-1" /> Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(expense);
              }}
            >
              <Pencil className="size-4 mr-1" /> Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
