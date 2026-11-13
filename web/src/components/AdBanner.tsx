"use client";

import AdSlot from "@/components/ads/AdSlot";
import type { AdPlacement } from "@/lib/ads";

type AdBannerProps = {
  placement?: Extract<AdPlacement, "top" | "dashboard">;
};

/**
 * Backwards-compatible wrapper around `AdSlot`. New code should use `AdSlot`
 * directly with an explicit placement.
 */
export default function AdBanner({ placement = "top" }: AdBannerProps) {
  return <AdSlot placement={placement} />;
}
