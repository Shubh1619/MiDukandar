export const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REVERSED: "border-red-200 bg-red-50 text-red-600",
  CANCELED: "border-muted bg-muted text-muted-foreground",
  HELD: "border-blue-200 bg-blue-50 text-blue-700",
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PARTIAL: "border-royal-300 bg-royal-50 text-royal-700",
  UNPAID: "border-red-200 bg-red-50 text-red-600",
};

export const STOCK_MOVE_BADGE: Record<string, string> = {
  OPENING: "border-blue-200 bg-blue-50 text-blue-700",
  PURCHASE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SALE: "border-red-200 bg-red-50 text-red-700",
  ADJUSTMENT: "border-royal-300 bg-royal-50 text-royal-700",
  REVERSAL: "border-purple-200 bg-purple-50 text-purple-700",
};

export const LEDGER_TYPE_BADGE: Record<string, string> = {
  DEBIT: "border-red-200 bg-red-50 text-red-700",
  CREDIT: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const PAYMENT_TYPE_BADGE: Record<string, string> = {
  RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAID: "border-blue-200 bg-blue-50 text-blue-700",
};

export const STOCK_LEVEL_BADGE: Record<string, string> = {
  OK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LOW: "border-royal-300 bg-royal-50 text-royal-700",
};

export const UDHAARI_STATUS_BADGE: Record<string, string> = {
  PENDING: "border-red-200 bg-red-50 text-red-600",
  PARTIAL: "border-royal-300 bg-royal-50 text-royal-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
};