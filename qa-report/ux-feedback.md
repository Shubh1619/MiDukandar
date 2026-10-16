# MiDukandar QA Report - UX Feedback

## Automated observations

- **Validation messages** are present and structured (`{ error, code }`) for the happy-path 400s (sale qty=0, empty lines, negative discount, gst>100, zero-amount expense, overpayment). Good.
- **Two failure modes leak implementation detail to users/operators:** invalid date -> 500 with a raw PG code (D10, G09c) and non-UUID ids -> 500 (G10). These present as generic "Internal server error" in the UI.
- **Stock-movement report filter is broken** (G09): choosing any search term/category shows an error instead of filtered rows.
- **Duplicate product names are accepted** when a SKU is involved (C03) - users can accidentally create two "Tata Salt" rows and split stock.
- **i18n:** web en=hi=mr=332 keys and guard passes (`web/scripts/i18n-check.mjs`); mobile ARB parity via `flutter gen-l10n`. No drift detected at this revision.

## Manual checklist (not automatable here)

These require a device/emulator or a browser session and must be run by a human:

1. **Onboarding/OTP** - request code, wrong code, resend, expiry, "too many requests" copy.
2. **Invoice builder** - add/remove lines, barcode scan, discount (flat/%), GST preview, hold + resume, print/share PDF.
3. **Offline/slow network** - loading states, retries, error toasts on timeout.
4. **Reports** - P&L and GST screens match the API numbers; date-range picker edge cases.
5. **Supplier payment history** - list, amount entry, overpayment guard message.
6. **Referral** - invite link, `/onboard?ref=`, credit visible in Settings > Refer.
7. **Responsive** - web at 360/768/1280px; mobile portrait + landscape.
8. **Accessibility** - keyboard focus order, contrast, screen-reader labels on icon buttons.

## Suggested UX follow-ups

- Give the stock-movement filter a user-facing "temporarily unavailable" state (until G09 is fixed) to avoid a hard error page.
- Surface duplicate-name conflicts inline in the product form, including when a SKU is present.
- Replace generic 500 copy with "Something went wrong, please retry" plus a support code that maps to the server log (never the raw PG code).
