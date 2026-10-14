"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}

export function StatCard({ icon: Icon, label, value, sub, tone = "text-navy-900" }: StatCardProps) {
  return (
    <Card className="stat-animate">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-navy-50">
            <Icon className="size-4 text-navy-600" />
          </span>
        </div>
        <p className={cn("mt-1.5 font-display text-2xl font-bold tabular-nums sm:text-[27px]", tone)}>
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}