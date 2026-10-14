"use client";

import { ClipboardList, PackageCheck, PackageOpen, PackageX } from "lucide-react";
import type { ProductSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  summary: ProductSummary | null;
  loading: boolean;
}

const presets = {
  total: { icon: ClipboardList, label: "Total products", tone: "text-muted-foreground" },
  active: { icon: PackageCheck, label: "Active", tone: "text-emerald-700" },
  low: { icon: PackageOpen, label: "Low stock", tone: "text-royal-600" },
  out: { icon: PackageX, label: "Out of stock", tone: "text-destructive" },
} as const;

export default function SummaryCards({ summary, loading }: Props) {
  const items: { key: keyof typeof presets; value: number }[] = summary
    ? [
        { key: "total", value: summary.total },
        { key: "active", value: summary.active },
        { key: "low", value: summary.low },
        { key: "out", value: summary.out },
      ]
    : [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-8 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ key, value }) => {
        const p = presets[key];
        const Icon = p.icon;
        return (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                <Icon className={`size-5 ${p.tone}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-muted-foreground">{p.label}</p>
                <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}