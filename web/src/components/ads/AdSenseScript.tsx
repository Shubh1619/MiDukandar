"use client";

import Script from "next/script";
import { ADSENSE_CLIENT } from "@/lib/ads";

/**
 * Loads the AdSense library once for the whole app. Individual `AdSlot`s push
 * their own `<ins>` elements onto the queue.
 */
export default function AdSenseScript() {
  if (!ADSENSE_CLIENT) return null;

  return (
    <Script
      id="adsbygoogle"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        ADSENSE_CLIENT,
      )}`}
    />
  );
}
