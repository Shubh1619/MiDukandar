export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ChallanLineInput {
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
}

export interface ChallanLineMoney {
  goods: number;
  discount: number;
  taxable: number;
  gst: number;
  net: number;
}

/** Line math for the purchase challan. Amount is goods after Dis1%, before GST. */
export function challanLine(input: ChallanLineInput): ChallanLineMoney {
  const qty = Number(input.quantity) || 0;
  const rate = Number(input.rate) || 0;
  const discPct = Math.min(Math.max(Number(input.discountPercent) || 0, 0), 100);
  const taxRate = Math.min(Math.max(Number(input.taxRate) || 0, 0), 100);
  const goods = round2(qty * rate);
  const discount = round2((goods * discPct) / 100);
  const taxable = round2(Math.max(goods - discount, 0));
  const gst = round2((taxable * taxRate) / 100);
  const net = round2(taxable + gst);
  return { goods, discount, taxable, gst, net };
}

export function challanTotals(lines: ChallanLineMoney[]): ChallanLineMoney {
  return lines.reduce(
    (acc, line) => ({
      goods: round2(acc.goods + line.goods),
      discount: round2(acc.discount + line.discount),
      taxable: round2(acc.taxable + line.taxable),
      gst: round2(acc.gst + line.gst),
      net: round2(acc.net + line.net),
    }),
    { goods: 0, discount: 0, taxable: 0, gst: 0, net: 0 },
  );
}

export function formatChallanDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}-${m}-${y}`;
}
