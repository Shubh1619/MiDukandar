# Ads setup

MiDukandar renders banner, interstitial and rewarded ads through Google's ad
stack:

| Surface | SDK | Package / script |
| --- | --- | --- |
| Web (Next.js) | AdSense | `adsbygoogle.js`, `<ins class="adsbygoogle">` |
| Android / iOS (Flutter) | AdMob | `google_mobile_ads` 9.x |

Android AdMob and web AdSense use the MiDukandar production IDs built into the
code. iOS still uses Google test units. Nothing renders unless the store's plan
allows it.

## Plan gating

Ad visibility comes from the plan returned by `GET /api/store` as
`planDetails` (`adsEnabled`, `adsTier`, `status`).

- `adsEnabled` must be `true` and `status` must be `ACTIVE`, otherwise every ad
  slot renders nothing.
- `adsTier: "MINIMAL"` sees **only** the top banner.
- `adsTier: "STANDARD"` sees every banner plus interstitial/rewarded ads.
- Public marketing pages (`landing`, `pricing`) are not tied to a signed-in
  store. They are gated only by whether AdSense is configured.

Single sources of truth:

- Web: `web/src/lib/ads.ts` (`canShowAds`, `AD_PLACEMENTS`)
- Flutter: `app/lib/ads/ad_policy.dart` (`AdPolicy`)

Do not add ad widgets outside these policies; the widgets already check them.

## Web (AdSense)

### Ad units

The publisher (`ca-pub-5690703416607762`) and three ad units are built into
`web/src/lib/ads.ts`, so the web app serves ads with no environment variables:

| Unit | Slot ID | Used by |
| --- | --- | --- |
| Display | `2625894725` | `top`, `reports`, `sidebar`, `footer`, `pricing` |
| Free-feed | `9822517604` | `dashboard`, `invoices`, `products`, `customers`, `expenses` |
| In-article | `7004782570` | `landing` |

`mobile-anchor` stays in-house only: sticky AdSense ads must be served through
Auto ads' anchor format, and a manually fixed unit risks a policy violation.

### Environment overrides

Each placement still has a `NEXT_PUBLIC_ADSENSE_SLOT_*` override (for example
`NEXT_PUBLIC_ADSENSE_SLOT_TOP`). Set one only when you want a different unit for
that placement; empty values fall back to the built-in unit above.

To turn AdSense off and show the in-house "Sponsored" promos, set
`NEXT_PUBLIC_ADSENSE_CLIENT` to an empty string at build time. `NEXT_PUBLIC_*`
values are inlined, so they must be present when `next build` runs.

To use AdSense on the public web you also need to:

1. Add your domain to AdSense and wait for site approval.
2. Keep the publisher ID in the same `ca-pub-…` format used by
   `AdSenseScript`.
3. Serve `web/public/ads.txt` (already contains the MiDukandar publisher line)
   at the site root.

### Behaviour without configuration

Every signed-in placement has a house fallback (`houseFallback: true`), so the
slot renders an in-house "Sponsored" promo card instead of collapsing when
AdSense is disabled. Public `landing` and `pricing` slots have no house fallback
and render nothing when AdSense is disabled.

`next.config.ts` adds the AdSense script, connect and frame CSP origins whenever
a publisher ID is present (the MiDukandar publisher is the default), so the CSP
stays strict when AdSense is disabled.

### Placement inventory (web)

| Placement | Surface | Tier | Unit | Component |
| --- | --- | --- | --- | --- |
| `top` | Under the authenticated header | MINIMAL+ | display | `components/shell/app-shell.tsx` |
| `dashboard` | Dashboard body | STANDARD | feed | `app/(main)/dashboard/page.tsx` |
| `invoices` | Invoice list | STANDARD | feed | `app/(main)/invoices/page.tsx` |
| `products` | Product list | STANDARD | feed | `app/(main)/products/page.tsx` |
| `customers` | Customer list | STANDARD | feed | `app/(main)/customers/page.tsx` |
| `reports` | Reports | STANDARD | display | `app/(main)/reports/page.tsx` |
| `expenses` | Expenses | STANDARD | feed | `app/(main)/expenses/page.tsx` |
| `sidebar` | Desktop sidebar | STANDARD | display | `components/shell/Sidebar.tsx` |
| `footer` | Above the site footer | STANDARD | display | `components/shell/app-shell.tsx` |
| `mobile-anchor` | Dismissible bottom anchor, mobile only | STANDARD | house only | `components/shell/app-shell.tsx` |
| `landing` | Public landing page | public | article | `components/landing/MiDukandarLanding.tsx` |
| `pricing` | Public pricing page | public | display | `app/pricing/page.tsx` |

## Flutter (AdMob)

### App IDs

| Platform | Where | Value |
| --- | --- | --- |
| Android | `app/android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID` | `ca-app-pub-5690703416607762~1796328162` |
| iOS | `app/ios/Runner/Info.plist` → `GADApplicationIdentifier` | `ca-app-pub-3940256099942544~1458002511` (test) |

Android is configured with the production MiDukandar AdMob app. iOS still
needs its own AdMob app before publishing.

### Ad unit IDs

Unit IDs are compile-time defines with defaults in
`app/lib/ads/ad_config.dart`:

```sh
flutter build apk \
  --dart-define=ADMOB_ANDROID_BANNER_ID=ca-app-pub-.../... \
  --dart-define=ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-.../... \
  --dart-define=ADMOB_ANDROID_REWARDED_ID=ca-app-pub-.../...
```

iOS equivalents: `ADMOB_IOS_BANNER_ID`, `ADMOB_IOS_INTERSTITIAL_ID`,
`ADMOB_IOS_REWARDED_ID`.

Defaults:

| Format | Android (production) | iOS (test) |
| --- | --- | --- |
| Banner | `ca-app-pub-5690703416607762/4142815519` | `ca-app-pub-3940256099942544/2934735716` |
| Interstitial | `ca-app-pub-5690703416607762/2561160591` | `ca-app-pub-3940256099942544/4411468910` |
| Rewarded | `ca-app-pub-5690703416607762/3292768272` | `ca-app-pub-3940256099942544/1712485313` |

Use test units on debug builds where possible: repeatedly tapping your own live
ads can get the AdMob account suspended.

### Placement inventory (Flutter)

| Placement | Surface | Tier |
| --- | --- | --- |
| `top` | Under the app bar, all tabs (`main.dart`) | MINIMAL+ |
| `dashboard` | After the stat grid | STANDARD |
| `invoices` | Above the invoice list | STANDARD |
| `products` | Above the product list | STANDARD |
| `customers` | Above the customer list | STANDARD |
| `reports` | After the GST summary | STANDARD |
| `expenses` | After the month summary cards | STANDARD |
| Rewarded card | Settings, above Save | STANDARD |
| Interstitial | After invoice create / mark-paid, purchase create, payment receipt | STANDARD |

Interstitials are throttled by `AdPolicy`/`AdService` and only attempt to show
when a previously loaded ad exists; they never block the underlying action.

Banner widgets are implemented through conditional imports
(`md_ad_banner.dart` → `md_ad_banner_mobile.dart` / `_stub.dart`) so web and
desktop builds do not import `google_mobile_ads`.

### Native ads

Native ad factories require per-platform native layout code (Android XML +
`NativeAdFactory`, iOS `FLTNativeAdFactory`). That is intentionally out of
scope for this setup. Use AdMob banners, interstitials and the rewarded card
instead, or add factories under `app/android/...` and `app/ios/...` later.

## Verification

```sh
# Web
cd web
npm run typecheck
npm run lint

# Flutter
cd app
flutter analyze
```

On a device with test IDs, test ads should appear only for a store whose plan
has `adsEnabled: true`. Toggle the plan in the backend/DB to confirm that
`MINIMAL` hides everything except the top banner and that a non-`ACTIVE` plan
hides all ads.
