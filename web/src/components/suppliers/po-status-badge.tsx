"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseOrderStatus } from "@/lib/types";

const STYLES: Record<PurchaseOrderStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-100 text-amber-800",
  received: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

const LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  received: "Received",
  cancelled: "Cancelled",
};

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant="outline" className={cn("border-transparent", STYLES[status] ?? "")}>{LABELS[status] ?? status}</Badge>;
}