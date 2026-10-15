"use client";

import { useEffect, useState } from "react";
import { Boxes, ReceiptText, TrendingUp } from "lucide-react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1800;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span className="stat-animate font-display tabular-nums">
      {count.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

const features = [
  { icon: ReceiptText, title: "Fast Billing", desc: "GST-ready bills in seconds" },
  { icon: Boxes, title: "Smart Inventory", desc: "Live stock & low-stock alerts" },
  { icon: TrendingUp, title: "Business Insights", desc: "Sales, profit & udhaari in one view" },
];

const bars = [34, 52, 40, 66, 58, 84, 72];

export default function LeftPanel() {
  return (
    <div className="relative flex min-h-[600px] h-full flex-col justify-between overflow-hidden bg-navy-950 px-8 py-6 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-royal-500/15 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-navy-600/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 34px, rgba(255,255,255,0.06) 34px, rgba(255,255,255,0.06) 68px)",
          }}
        />
        <div className="absolute right-8 top-32 size-40 rounded-full border border-white/10" />
        <div className="absolute right-2 top-44 size-24 rounded-full border border-white/5" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="mb-6 inline-flex h-20 w-fit items-center rounded-2xl bg-white px-4 py-2">
          <img
            src="/logo.png"
            alt="MiDukandar - Smart Business"
            className="h-full w-auto object-contain"
          />
        </div>

        <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-royal-200">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Smart Business Management
        </span>

        <h2 className="font-display text-[1.9rem] font-bold leading-[1.05] lg:text-4xl">
          Run your shop.
          <br />
          Smarter every day.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-200">
          Billing, inventory, udhaari and reports - one calm dashboard for Indian shops and
          businesses.
        </p>

        <div className="mt-5 grid max-w-md grid-cols-3 gap-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-royal-400/40 hover:bg-white/[0.08]"
            >
              <f.icon className="mb-2.5 size-5 text-royal-300" strokeWidth={1.75} />
              <div className="font-display text-sm font-semibold">{f.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-navy-300">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="relative mt-6 min-h-24">
          <div className="float-slow absolute left-0 top-0 w-56 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-royal-500/20 text-royal-300">
                  <ReceiptText className="size-3.5" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-white">Today&apos;s sales</div>
                  <div className="text-[10px] text-navy-300">Bill #1024</div>
                </div>
              </div>
              <div className="font-display text-sm font-bold text-emerald-300">₹12,480</div>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-white/10" />
              <div className="h-1.5 w-4/5 rounded-full bg-white/10" />
              <div className="h-1.5 w-full rounded-full bg-white/10" />
            </div>
          </div>

          <div className="float-slower absolute right-2 top-6 w-44 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-white">This week</div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                <TrendingUp className="size-3" /> +18%
              </span>
            </div>
            <div className="mt-2.5 flex h-10 items-end gap-1.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${i === bars.length - 1 ? "bg-royal-400" : "bg-white/15"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
        <div className="flex -space-x-2">
          {["bg-royal-400", "bg-emerald-400", "bg-amber-400"].map((c) => (
            <span key={c} className={`size-6 rounded-full border-2 border-navy-950 ${c}`} />
          ))}
        </div>
        <p className="text-xs leading-relaxed text-navy-200">
          Trusted by{" "}
          <span className="font-display font-bold text-white">
            <AnimatedCounter target={4800} suffix="+" />
          </span>{" "}
          shops across India
        </p>
      </div>
    </div>
  );
}