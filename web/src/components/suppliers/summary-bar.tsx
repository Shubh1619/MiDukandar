"use client";

import { Truck, Wallet, Clock, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import type { SupplierSummary } from "@/lib/types";

export function SupplierSummaryBar({ summary }: { summary: SupplierSummary | null }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Truck}
        label={t("suppliers")}
        value={summary ? String(summary.total) : "…"}
        sub={summary ? `${summary.settledCount} ${t("settled")}` : ""}
      />
      <StatCard
        icon={Wallet}
        label={t("totalPayable")}
        value={summary ? formatINR(summary.totalPayable) : "…"}
        sub={t("dueToSuppliers")}
        tone={summary && summary.totalPayable > 0 ? "text-red-600" : "text-navy-900"}
      />
      <StatCard
        icon={Clock}
        label={t("outstandingPaying")}
        value={summary ? String(summary.outstandingCount) : "…"}
        sub={t("suppliersWithPayable")}
      />
      <StatCard
        icon={AlertTriangle}
        label={t("overdue")}
        value={summary ? String(summary.overdueCount) : "…"}
        sub={t("overdueBadgesHint")}
        tone={summary && summary.overdueCount > 0 ? "text-red-600" : "text-navy-900"}
      />
    </div>
  );
}