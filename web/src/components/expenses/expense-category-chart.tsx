"use client";

import { PieChart, FolderOpen } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { ExpenseCategoryBreakdown } from "@/lib/types";

interface ExpenseCategoryChartProps {
  categories: ExpenseCategoryBreakdown[];
  totalThisMonth: number;
}

const CATEGORY_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-slate-500",
];

export function ExpenseCategoryChart({ categories, totalThisMonth }: ExpenseCategoryChartProps) {
  if (!categories || categories.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-lg border bg-card p-4 text-center text-xs text-muted-foreground">
        <FolderOpen className="mb-2 size-6 text-muted-foreground/60" />
        <p>No category breakdown available for this month</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Category Spend Breakdown</h3>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          Total: {formatINR(totalThisMonth)}
        </span>
      </div>

      <div className="space-y-2.5 pt-1">
        {categories.map((cat, idx) => {
          const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

          return (
            <div key={cat.categoryId || `cat-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{cat.categoryName}</span>
                <span className="tabular-nums font-semibold">
                  {formatINR(cat.total)}{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">
                    ({cat.percentage}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full ${colorClass} transition-all duration-300`}
                  style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
