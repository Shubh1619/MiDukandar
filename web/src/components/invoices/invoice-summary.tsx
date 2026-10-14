"use client";

import { AlarmClock, IndianRupee, ReceiptText, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { formatINR } from "@/lib/format";
import type { InvoiceSummary } from "@/lib/types";

interface InvoiceSummaryBarProps {
  summary: InvoiceSummary | null;
  loading: boolean;
}

export function InvoiceSummaryBar({ summary, loading }: InvoiceSummaryBarProps) {
  const { t } = useI18n();
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={ReceiptText}
        label={t("totalInvoices")}
        value={String(summary.totalInvoices)}
        sub={t("invoices")}
      />
      <StatCard
        icon={IndianRupee}
        label={t("totalRevenue")}
        value={formatINR(summary.totalRevenue)}
        sub={t("total")}
        tone="text-emerald-600"
      />
      <StatCard
        icon={Wallet}
        label={t("pendingAmount")}
        value={formatINR(summary.pendingAmount)}
        sub={t("due")}
        tone="text-amber-600"
      />
      <StatCard
        icon={AlarmClock}
        label={t("overdueCount")}
        value={String(summary.overdueCount)}
        sub={t("overdue")}
        tone={summary.overdueCount > 0 ? "text-destructive" : "text-navy-900"}
      />
    </div>
  );
}