# MiDukandar QA Report - Summary

- **Date:** 2026-10-16
- **Scope:** LOCAL stack only (backend http://localhost:4000, web http://localhost:3000, Postgres via docker). No production/Render or Brevo egress was exercised.
- **Method:** Automated black-box API tests (Node harness under `qa-report/scripts/`) plus source review for root-cause. Mobile app is **manual** (no integration_test/Playwright available).
- **Accounts:** store1 owner (Pro), store2 owner (Free), manager/cashier/staff on store1, platform superadmin.

## Totals

| Status | Count |
|---|---|
| PASS | 159 |
| FAIL | 13 |
| WARN | 2 |
| MANUAL | 2 |
| **Total** | **176** |

By section: A=20/22, B=26/27, C=47/49, D=14/15, E=22/23, F=8/15, G=22/25

## Failures

| ID | Title | Severity | Expected | Actual |
|---|---|---|---|---|
| A06 | OTP request existing email does not return OTP in body | medium | no OTP value in response body | status=200 leaksOtp=true |
| B09 | Cashier product-create matches permission matrix (can_manage_products=false) | medium | 403 per DEFAULT_PERMISSIONS.CASHIER.can_manage_products=false | 201 |
| C03 | Duplicate product NAME blocked even when existing product has a SKU | medium | 409 PRODUCT_EXISTS | 201 |
| D10 | GST invalid date -> 400 | medium | 400 | 500 {"error":"Internal server error","code": |
| E15 | Suspended tenant still has API access (suspension not enforced) | high | Suspended tenant requests rejected (401/403) | suspended tenant GET /auth/me = 200 |
| F01 | Web home returns 200 | medium | 200 | 307 |
| F04 | Unauthenticated /dashboard redirects to login | medium | 3xx -> /login | 200 loc= |
| F05 | Web sets security headers | medium | HSTS, CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy | missing=hsts |
| F06 | API responses set X-Content-Type-Options nosniff | low | nosniff | absent |
| F09b | robots.txt present | low | 200 | 404 |
| G09 | Report stock/movements search/category filter does not 500 | medium | 200 for both filters | search=500 category=500 |
| G09c | Error responses do not leak Postgres error codes | low | generic error, no PG code | leaked {"error":"Internal server error","code":"22P02"} |
| G10 | Non-UUID path id rejected with 400 | medium | 400 | 500 |


## Warnings

| ID | Title | Severity | Expected | Actual |
|---|---|---|---|---|
| A05 | OTP request unknown email (LOGIN) leaks account existence (404 vs 200) | - | Ideally identical response for existent/non-existent emails | unknown=404 (ACCOUNT_NOT_FOUND), known=200 |
| C32 | List recurring expenses: GET /api/recurring-expenses is inconsistent (404); real list is /recurring | - | GET /api/recurring-expenses returns 200 (natural REST path) | GET /api/recurring-expenses=404, GET /api/recurring-expenses/recurring=200 |


## Manual / not automatable

- **F13** Mobile app: full manual pass required - Flutter app (app/) has no integration_test/Playwright. Needs a device/emulator: onboarding, OTP login, invoice create + hold/resume, invoice PDF share, reports P&L/GST, supplier payment history, referral sheet. Not automatable in this environment.
- **F14** Cross-device responsive check - Verify web layout at 360px/768px/1280px and mobile in portrait/landscape.

## Coverage notes

- Sections A-E and G are API-automated end to end. Section F automates web reachability, redirects, security headers and CORS; UI/UX remains manual.
- Recurring-expense API exists but no web/mobile client calls it (see warning C32).
- Full raw results: `qa-report/_data/results.jsonl`; case table: `qa-report/test-cases.csv`.
