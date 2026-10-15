export type Step = 1 | 2 | 3;
export type Method = "mobile" | "email";

export interface MerchantContextResponse {
  ok: boolean;
  matched?: boolean;
}