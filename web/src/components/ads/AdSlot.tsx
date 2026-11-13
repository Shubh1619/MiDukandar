"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Megaphone, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  ADSENSE_CLIENT,
  ADSENSE_FEED_LAYOUT_KEY,
  AD_PLACEMENTS,
  adsenseSlotFor,
  canShowAds,
  type AdPlacement,
  type AdUnitKind,
} from "@/lib/ads";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  placement: AdPlacement;
  className?: string;
};

const AD_LABEL = "Advertisement";

function AdUnit({
  placement,
  slot,
  kind,
  className,
}: {
  placement: AdPlacement;
  slot: string;
  kind: AdUnitKind;
  className?: string;
}) {
  const isFluid = kind !== "display";
  return (
    <ins
      className={cn("adsbygoogle block w-full", className)}
      style={
        kind === "article"
          ? { display: "block", textAlign: "center" }
          : { display: "block" }
      }
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={isFluid ? "fluid" : "auto"}
      data-full-width-responsive={kind === "display" ? "true" : undefined}
      data-ad-layout={kind === "article" ? "in-article" : undefined}
      data-ad-layout-key={kind === "feed" ? ADSENSE_FEED_LAYOUT_KEY : undefined}
      data-ad-placement={placement}
    />
  );
}

export default function AdSlot({ placement, className }: AdSlotProps) {
  const plan = useAuth((state) => state.store?.planDetails);
  const [dismissed, setDismissed] = useState(false);
  const pushed = useRef(false);

  const config = AD_PLACEMENTS[placement];
  const enabled = canShowAds(plan, placement);
  const unit = config.unit;
  const slot = adsenseSlotFor(placement);
  const hasAdUnit = Boolean(ADSENSE_CLIENT && unit && slot);
  const showHouse = !hasAdUnit && config.houseFallback === true;

  useEffect(() => {
    if (!enabled || !hasAdUnit || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // The AdSense script may still be loading; the next slot mount retries.
    }
  }, [enabled, hasAdUnit]);

  if (!enabled) return null;
  if (config.format === "anchor" && dismissed) return null;
  if (!hasAdUnit && !showHouse) return null;

  const tier =
    plan?.adsTier ?? (config.publicPlacement ? "PUBLIC" : undefined);

  if (hasAdUnit && unit) {
    if (config.format === "bar") {
      return (
        <aside
          data-ad-placement={placement}
          data-ads-tier={tier}
          aria-label={AD_LABEL}
          className={cn(
            "border-b border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50",
            className,
          )}
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-700/70">
              {AD_LABEL}
            </p>
            <AdUnit placement={placement} slot={slot} kind={unit} className="min-h-[60px]" />
          </div>
        </aside>
      );
    }

    if (config.format === "anchor") {
      return (
        <aside
          data-ad-placement={placement}
          data-ads-tier={tier}
          aria-label={AD_LABEL}
          className={cn(
            "fixed inset-x-0 bottom-[61px] z-30 border-t border-amber-200 bg-amber-50/95 px-2 pb-1 pt-2 backdrop-blur sm:hidden",
            className,
          )}
        >
          <button
            type="button"
            aria-label="Dismiss advertisement"
            onClick={() => setDismissed(true)}
            className="absolute right-1 top-1 rounded-full p-1 text-amber-700/70 transition-colors hover:bg-amber-200 hover:text-amber-950"
          >
            <X className="size-3" aria-hidden />
          </button>
          <p className="mb-1 pl-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-700/70">
            {AD_LABEL}
          </p>
          <AdUnit placement={placement} slot={slot} kind={unit} className="min-h-[50px]" />
        </aside>
      );
    }

    if (config.format === "sidebar") {
      return (
        <div
          data-ad-placement={placement}
          data-ads-tier={tier}
          aria-label={AD_LABEL}
          className={cn(
            "overflow-hidden rounded-xl bg-white p-1.5 shadow-sm",
            className,
          )}
        >
          <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-navy-400">
            {AD_LABEL}
          </p>
          <AdUnit placement={placement} slot={slot} kind={unit} className="min-h-[200px]" />
        </div>
      );
    }

    return (
      <div
        data-ad-placement={placement}
        data-ads-tier={tier}
        aria-label={AD_LABEL}
        className={cn(
          "overflow-hidden rounded-xl border border-navy-100 bg-white p-2",
          className,
        )}
      >
        <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-navy-400">
          {AD_LABEL}
        </p>
        <AdUnit placement={placement} slot={slot} kind={unit} className="min-h-[90px]" />
      </div>
    );
  }

  if (config.format === "bar") {
    return (
      <aside
        data-ad-placement={placement}
        data-ads-tier={tier}
        aria-label="Sponsored content"
        className={cn(
          "border-b border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-2.5 sm:px-6",
          className,
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
          <p className="flex min-w-0 items-center gap-2 text-amber-900">
            <Megaphone className="size-3.5 shrink-0 text-amber-600" aria-hidden />
            <span className="truncate">
              <span className="font-bold">{config.title}</span> · {config.message}
            </span>
          </p>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-800 hover:text-amber-950"
          >
            {config.ctaLabel} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </aside>
    );
  }

  if (config.format === "sidebar") {
    return (
      <div
        data-ad-placement={placement}
        data-ads-tier={tier}
        aria-label="Sponsored content"
        className={cn(
          "rounded-xl border border-navy-800 bg-navy-900/80 p-3",
          className,
        )}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-navy-400">
          Sponsored
        </p>
        <p className="mt-1 text-xs font-bold text-white">{config.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-navy-300">{config.message}</p>
        <Link
          href="/pricing"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-royal-300 hover:text-royal-200"
        >
          {config.ctaLabel} <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </div>
    );
  }

  if (config.format === "anchor") {
    return (
      <aside
        data-ad-placement={placement}
        data-ads-tier={tier}
        aria-label="Sponsored content"
        className={cn(
          "fixed inset-x-0 bottom-[61px] z-30 border-t border-amber-200 bg-amber-50/95 px-3 py-2 backdrop-blur sm:hidden",
          className,
        )}
      >
        <button
          type="button"
          aria-label="Dismiss advertisement"
          onClick={() => setDismissed(true)}
          className="absolute right-1 top-1 rounded-full p-1 text-amber-700/70 transition-colors hover:bg-amber-200 hover:text-amber-950"
        >
          <X className="size-3" aria-hidden />
        </button>
        <div className="flex items-center gap-2 pr-6 text-xs text-amber-900">
          <Megaphone className="size-3.5 shrink-0 text-amber-600" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-bold">{config.title}</span> · {config.message}
          </span>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-800 hover:text-amber-950"
          >
            {config.ctaLabel} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-ad-placement={placement}
      data-ads-tier={tier}
      aria-label="Sponsored content"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
        <Megaphone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-700/70">
          Sponsored
        </p>
        <p className="truncate text-xs font-bold text-amber-950">{config.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-amber-900/80">
          {config.message}
        </p>
      </div>
      <Link
        href="/pricing"
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
      >
        {config.ctaLabel} <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </aside>
  );
}
