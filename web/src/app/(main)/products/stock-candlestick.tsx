"use client";

import type { StockMovement } from "@/lib/types";

interface Candle {
  dayKey: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  count: number;
}

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCandles(movements: StockMovement[], maxDays = 25): Candle[] {
  const chrono = [...movements].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  if (chrono.length === 0) return [];

  const buckets = new Map<string, StockMovement[]>();
  for (const m of chrono) {
    const key = dayKeyOf(m.createdAt);
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }

  const candles: Candle[] = [];
  for (const key of [...buckets.keys()].sort()) {
    const arr = buckets.get(key)!;
    const first = arr[0];
    const last = arr[arr.length - 1];
    const open = Number(first.balanceAfter ?? 0) - Number(first.qty ?? 0);
    const close = Number(last.balanceAfter ?? 0);
    let high = Math.max(open, close);
    let low = Math.min(open, close);
    for (const m of arr) {
      const b = Number(m.balanceAfter ?? 0);
      high = Math.max(high, b);
      low = Math.min(low, b);
    }
    candles.push({
      dayKey: key,
      label: new Date(arr[0].createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      open,
      high,
      low,
      close,
      count: arr.length,
    });
  }
  return candles.slice(-maxDays);
}

const UP = "#16a34a";
const DOWN = "#dc2626";
const FLAT = "#64748b";

export default function StockCandlestick({ movements }: { movements: StockMovement[] }) {
  const candles = buildCandles(movements);
  if (candles.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Not enough stock history for this product yet.
      </div>
    );
  }

  const W = 660;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 24;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const rawMin = Math.min(...candles.map((c) => c.low));
  const rawMax = Math.max(...candles.map((c) => c.high));
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const y = (v: number) => PAD_TOP + innerH * (1 - (v - min) / (max - min || 1));

  const step = innerW / candles.length;
  const bodyW = Math.max(6, Math.min(18, step * 0.55));
  const midY = y((min + max) / 2);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-sm font-medium">Stock candlestick {'\u2014'} daily balance</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-current" style={{ color: UP }} /> Up</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-current" style={{ color: DOWN }} /> Down</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Candlestick chart of stock balance over recent days">
        <line x1={PAD_X} x2={W - PAD_X} y1={y(min)} y2={y(min)} stroke="currentColor" strokeOpacity={0.15} />
        <line x1={PAD_X} x2={W - PAD_X} y1={midY} y2={midY} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
        <line x1={PAD_X} x2={W - PAD_X} y1={y(max)} y2={y(max)} stroke="currentColor" strokeOpacity={0.15} />

        <text x={PAD_X} y={y(max) - 4} className="fill-muted-foreground" fontSize={10}>{Math.round(max)}</text>
        <text x={PAD_X} y={y(min) + 12} className="fill-muted-foreground" fontSize={10}>{Math.round(min)}</text>

        {candles.map((c, i) => {
          const cx = PAD_X + step * i + step / 2;
          const up = c.close >= c.open;
          const color = c.close === c.open ? FLAT : up ? UP : DOWN;
          const bodyTop = y(Math.max(c.open, c.close));
          const bodyH = Math.max(1.5, Math.abs(y(c.open) - y(c.close)));
          return (
            <g key={c.dayKey}>
              <title>
                {`${c.label} (${c.count} change${c.count === 1 ? "" : "s"}) · O ${c.open} · H ${c.high} · L ${c.low} · C ${c.close}`}
              </title>
              <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
              <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} rx={1} fill={color} />
              {i % Math.max(1, Math.floor(candles.length / 6)) === 0 ? (
                <text x={cx} y={H - 8} className="fill-muted-foreground" fontSize={9} textAnchor="middle">{c.label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}