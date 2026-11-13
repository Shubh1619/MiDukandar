import type { PlanAdsTier, PlanDefinition } from "./plan-catalog";

/**
 * Every place a banner-style ad can be rendered. Each placement has its own
 * AdSense ad unit, so performance can be measured per surface.
 */
export type AdPlacement =
  | "top"
  | "dashboard"
  | "invoices"
  | "products"
  | "customers"
  | "reports"
  | "expenses"
  | "sidebar"
  | "footer"
  | "mobile-anchor"
  | "landing"
  | "pricing";

export type AdFormat = "bar" | "card" | "sidebar" | "anchor";

/**
 * AdSense unit shape. `display` is a responsive banner, `feed` is a free-feed
 * fluid unit, and `article` is the in-article fluid layout. A `null` unit means
 * the placement never calls AdSense and only shows the in-house promo.
 */
export type AdUnitKind = "display" | "feed" | "article";

export type AdPlacementConfig = {
  format: AdFormat;
  /** Lowest plan ad tier that may see this placement. */
  minTier: PlanAdsTier;
  /** Public pages are not tied to a signed-in store plan. */
  publicPlacement?: boolean;
  /** Show the in-house promo when no AdSense unit is configured. */
  houseFallback?: boolean;
  /** AdSense unit shape for this placement. */
  unit: AdUnitKind | null;
  title: string;
  message: string;
  ctaLabel: string;
};

/**
 * AdSense publisher ID (`ca-pub-…`). Public env vars are inlined at build
 * time, so this must be present when `next build` runs. The MiDukandar
 * publisher is the default; set `NEXT_PUBLIC_ADSENSE_CLIENT` to an empty string
 * to turn AdSense off and fall back to the house promos.
 */
export const ADSENSE_CLIENT = (
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-app-pub-5690703416607762"
).trim();

/** Ad units created in the MiDukandar AdSense account. */
export const ADSENSE_DEFAULT_SLOTS: Record<AdUnitKind, string> = {
  display: "2625894725",
  feed: "9822517604",
  article: "7004782570",
};

/** Layout key from the AdSense free-feed unit snippet. */
export const ADSENSE_FEED_LAYOUT_KEY = "-fb+5w+4e-db+86";

const SLOT_BY_PLACEMENT: Record<AdPlacement, string> = {
  top: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP ?? "").trim(),
  dashboard: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_DASHBOARD ?? "").trim(),
  invoices: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_INVOICES ?? "").trim(),
  products: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRODUCTS ?? "").trim(),
  customers: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_CUSTOMERS ?? "").trim(),
  reports: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_REPORTS ?? "").trim(),
  expenses: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPENSES ?? "").trim(),
  sidebar: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? "").trim(),
  footer: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER ?? "").trim(),
  "mobile-anchor": (process.env.NEXT_PUBLIC_ADSENSE_SLOT_MOBILE_ANCHOR ?? "").trim(),
  landing: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING ?? "").trim(),
  pricing: (process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRICING ?? "").trim(),
};

export function adsenseSlotFor(placement: AdPlacement) {
  const unit = AD_PLACEMENTS[placement].unit;
  if (!unit) return "";
  // A per-placement env override wins; otherwise use the matching AdSense unit.
  return SLOT_BY_PLACEMENT[placement] || ADSENSE_DEFAULT_SLOTS[unit];
}

export function isAdsenseConfigured(placement?: AdPlacement) {
  if (!ADSENSE_CLIENT) return false;
  return placement ? Boolean(adsenseSlotFor(placement)) : true;
}

export const AD_PLACEMENTS: Record<AdPlacement, AdPlacementConfig> = {
  top: {
    format: "bar",
    minTier: "MINIMAL",
    houseFallback: true,
    unit: "display",
    title: "Sponsored",
    message: "Discover tools to help your business grow.",
    ctaLabel: "Explore plans",
  },
  dashboard: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "feed",
    title: "Recommended for your business",
    message: "Explore add-ons that save time on billing, stock and reporting.",
    ctaLabel: "See plans",
  },
  invoices: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "feed",
    title: "Sponsored",
    message: "Get more from every bill with smarter billing tools.",
    ctaLabel: "Learn more",
  },
  products: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "feed",
    title: "Sponsored",
    message: "Keep stock moving with tools built for growing shops.",
    ctaLabel: "Learn more",
  },
  customers: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "feed",
    title: "Sponsored",
    message: "Grow repeat business with simple customer tools.",
    ctaLabel: "Learn more",
  },
  reports: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "display",
    title: "Sponsored",
    message: "Turn your numbers into decisions with deeper insights.",
    ctaLabel: "Learn more",
  },
  expenses: {
    format: "card",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "feed",
    title: "Sponsored",
    message: "Keep business spending organised and tax-ready.",
    ctaLabel: "Learn more",
  },
  sidebar: {
    format: "sidebar",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "display",
    title: "Upgrade your plan",
    message: "Remove ads and unlock more tools for your business.",
    ctaLabel: "View plans",
  },
  footer: {
    format: "bar",
    minTier: "STANDARD",
    houseFallback: true,
    unit: "display",
    title: "Sponsored",
    message: "More tools for shops and growing businesses.",
    ctaLabel: "Explore",
  },
  "mobile-anchor": {
    format: "anchor",
    minTier: "STANDARD",
    houseFallback: true,
    // Sticky AdSense units require Auto ads' anchor format; a manually fixed
    // unit risks a policy violation, so this surface stays in-house only.
    unit: null,
    title: "Sponsored",
    message: "Explore plans built for your business.",
    ctaLabel: "View",
  },
  landing: {
    format: "card",
    minTier: "MINIMAL",
    publicPlacement: true,
    houseFallback: false,
    unit: "article",
    title: "Sponsored",
    message: "",
    ctaLabel: "",
  },
  pricing: {
    format: "card",
    minTier: "MINIMAL",
    publicPlacement: true,
    houseFallback: false,
    unit: "display",
    title: "Sponsored",
    message: "",
    ctaLabel: "",
  },
};

/**
 * Plan gating is the single source of truth for ad visibility.
 * `MINIMAL` plans only get the top banner; `STANDARD` gets every surface.
 */
export function canShowAds(
  plan: PlanDefinition | null | undefined,
  placement: AdPlacement,
) {
  const config = AD_PLACEMENTS[placement];
  if (config.publicPlacement) return true;
  if (!plan?.adsEnabled) return false;
  if (plan.status !== "ACTIVE") return false;
  if (plan.adsTier === "MINIMAL") return config.minTier === "MINIMAL";
  return true;
}
