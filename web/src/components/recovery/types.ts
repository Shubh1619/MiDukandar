export type Step = 1 | 2 | 3;
export type Method = "mobile" | "email";

export interface MerchantContext {
  merchantId: string;
  storeName: string;
  city: string;
  ownerName: string;
  ownerInitials: string;
  gstin: string;
  terminalId: string;
  ledgerStatus: "Online" | "Safe";
  todayInvoices: number;
  pendingUdhaari: number;
  receipts: number;
}

export interface MerchantContextResponse {
  ok: boolean;
  merchant?: MerchantContext;
  verified?: boolean;
}