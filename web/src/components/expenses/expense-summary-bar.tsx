"use client";

import { Wallet, Calendar, PieChart, TrendingUp, TrendingDown } from "lucide-react";
import { formatINR } from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import type { ExpenseSummary } from "@/lib/types";

export function ExpenseSummaryBar({ summary }: { summary: ExpenseSummary | null }) {
  const pct = summary?.pctChangeVsLastMonth ?? 0;
  const isUp = pct > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Wallet}
        label="Today's Expenses"
        value={summary ? formatINR(summary.todayTotal) : "…"}
        sub="Out-of-pocket today"
        tone="text-amber-600"
      />
      <StatCard
        icon={Calendar}
        label="This Month's Total"
        value={summary ? formatINR(summary.thisMonthTotal) : "…"}
        sub={`Vs last month: ${formatINR(summary?.lastMonthTotal ?? 0)}`}
        tone="text-royal-600"
      />
      <StatCard
        icon={PieChart}
        label="Top Category"
        value={summary?.topCategory ? summary.topCategory.name : "None"}
        sub={summary?.topCategory ? formatINR(summary.topCategory.total) : "No spend recorded"}
      />
      <StatCard
        icon={isUp ? TrendingUp : TrendingDown}
        label="Vs Last Month"
        value={summary ? `${isUp ? "+" : ""}${summary.pctChangeVsLastMonth}%` : "…"}
        sub={isUp ? "Higher spend" : "Lower spend"}
        tone={isUp ? "text-red-600" : "text-emerald-600"}
      />
    </div>
  );
}
