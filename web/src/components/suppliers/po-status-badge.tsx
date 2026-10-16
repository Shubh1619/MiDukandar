"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import type { PurchaseOrderStatus } from "@/lib/types";

const STYLES: Record<PurchaseOrderStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-100 text-amber-800",
  received: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

const LABEL_KEYS: Record<PurchaseOrderStatus, string> = {
  draft: "statusDraft",
  sent: "statusSent",
  received: "statusReceived",
  cancelled: "statusCancelled",
};

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useI18n();
  const key = LABEL_KEYS[status];
  return <Badge variant="outline" className={cn("border-transparent", STYLES[status] ?? "")}>{key ? t(key) : status}</Badge>;
}