# MiDukandar — Read-Only Integration & Completion Audit

Scope: `backend/` (Fastify + raw SQL), `web/` (Next.js), `app/` (Flutter).
Method: static extraction of every backend route, every web call site and every mobile
call site, then a cross-match. **No source files were modified.**

All numbers below are reproducible:

```powershell
node audit/scripts/scan-backend.mjs
node audit/scripts/scan-web.mjs
node audit/scripts/scan-mobile.mjs
node audit/scripts/crossmatch.mjs
```

## Headline numbers

| Metric | Count |
|---|---|
| Backend route **URLs** (method+path, incl. dual mounts) | 162 |
| Backend route **handlers** (dual mounts collapsed) | 146 |
| Backend route files **not registered** in `app.ts` | 0 |
| Web API call sites | 145 (113 distinct method+path) |
| Mobile API call sites (screen-level) | 60 |
| Mobile `api_service.dart` methods defined but never called | 5 |
| Web call sites with **no** backend route | 1 (resolvable, see below) |
| Mobile call sites with **no** backend route | 0 |
| Backend handlers reached by **neither** web nor mobile | 29 |
| Endpoints used by **web only** | 61 |
| Endpoints used by **mobile only** | 3 |

> Mobile integration is measured at the **screen call-site** level (via
> `mobile-calls.csv`), not by the mere presence of a method in `api_service.dart`.
> Methods prefixed `_` (internal plumbing) count as live.

Raw evidence: `endpoint-map.csv`, `web-calls.csv`, `mobile-calls.csv`,
`mobile-endpoints.csv`, `crossmatch.md`, `module-matrix.md`, `module-endpoints.csv`.

## Per-module integration

`used` = handler is called by web and/or mobile. `web`/`mobile` = called by that client.
Full tables live in [`modules/`](./modules/README.md).

| module | handlers | web | mobile | neither | backend integration |
|---|---|---|---|---|---|
| DASHBOARD | 1 | 1 | 1 | 0 | 100% |
| BILLING | 2 | 2 | 2 | 0 | 100% |
| CUSTOMERS_UDHAARI | 10 | 10 | 8 | 0 | 100% |
| INVENTORY | 3 | 2 | 2 | 1 | 67% (web+mobile use 2/3) |
| PURCHASES | 10 | 10 | 3 | 0 | 100% (web-only feature) |
| GST_REPORTS | 6 | 6 | 2 | 0 | 100% web / **~33% mobile** |
| PRODUCTS | 19 | 17 | 8 | 2 | 89% |
| SUPPLIERS | 10 | 8 | 6 | 1 | 90% |
| UNGATED (auth/store/platform) | 41 | 31 | 10 | 9 | 78% (mostly infra) |
| USERS_ROLES | 13 | 9 | 4 | 4 | 69% |
| SALES_INVOICES | 12 | 8 | 5 | 4 | 67% |
| EXPENSES | 19 | 11 | 6 | 8 | 58% |

> Caveat: several "neither" rows are reached by a non-obvious caller and are in fact
> live (server-side fetch, gateway webhook, docker healthcheck). See `mismatches.md`
> for the corrected classification.

## Deliverables in this folder

- [`ui-without-endpoints.md`](./ui-without-endpoints.md) — UI that calls something the
  backend does not serve, and UI deep-links that land on missing pages.
- [`endpoints-not-integrated.md`](./endpoints-not-integrated.md) — backend handlers no
  client reaches, with the reason (dead duplicate, web-only, infra, or real gap).
- [`mismatches.md`](./mismatches.md) — method/path/auth discrepancies and scanner
  false-positives reconciled by hand.
- [`platform-gaps.md`](./platform-gaps.md) — feature parity matrix web vs mobile.
- [`modules/`](./modules/README.md) — one file per plan module with every endpoint.
- `endpoint-map.csv`, `web-calls.csv`, `mobile-calls.csv`, `mobile-endpoints.csv`,
  `crossmatch.md`, `module-matrix.md`, `module-endpoints.csv` — machine evidence.
- `scripts/` — the extraction scripts.

## Fix plan

### Fixed

- **P0 — Staff invite acceptance.** Added `web/src/app/invite/accept/page.tsx` +
  `web/src/components/invite/InviteAcceptClient.tsx` (token form → `POST
  /api/users/invite/accept`). The web users/settings pages now surface the returned
  invite link with a copy action, and the backend returns an absolute URL when
  `APP_URL` is set (`user.routes.ts`). The Flutter users screen now shows the link in a
  copy dialog too.

### P0 — must fix before this is usable end-to-end

1. **Render 508 loop** (only remaining P0) — `/api/*` returns "Loop Detected" because
   `BACKEND_URL` points at the public host. Set Render env
   `BACKEND_URL=http://127.0.0.1:5000` and redeploy. (User action; cannot be done from
   the repo.)

### P1 — feature is missing on a platform

3. **Reports missing on mobile.** Only 2 of 6 `GST_REPORTS` endpoints are reached by
   mobile; `api_service.dart` defines `getPnlReport` / `getGstReport` but no screen
   calls them and there is no reports entry on mobile home. Either build the screen or
   remove the dead methods.
4. **Purchase (GRN) entry missing on mobile.** Only 3/10 `PURCHASES` handlers are used
   by mobile; PO create/edit and purchase payments are web-only. Confirm this is
   intentional.
5. **Held sales (park/resume cart) has no UI** on either platform. 4 `SALES_INVOICES`
   handlers (`POST /api/sales/hold`, `GET /api/sales/held/list`, `GET/DELETE
   /api/sales/held/:id`) are dead. Either wire a "hold sale" action or drop the feature.
6. **Supplier payment history** — `GET /api/suppliers/:id/payments` unused; no payment
   list screen on either platform.
7. **Expense category edit/delete** and **expense-by-id** are not exposed in any UI.

### P2 — hygiene / correctness

8. **Duplicate recurring-expense implementation.** `expense.routes.ts` implements
   `/recurring*` inside `expenseRoutes` *and* `recurringExpenseRoutes`; the
   `expenseRoutes` copies are dead. Remove one.
9. **`/api/store/staff*` (3 handlers) duplicates `/api/users*`** — unused; delete or
   document as aliases.
10. **Invite requires email but the invite form allows phone-only** — the accept
    endpoint rejects invites with no email ("Email is required to accept this
    invite."), yet the web/mobile invite dialogs accept phone-only. Require email at
    invite time, or allow phone-based acceptance.
11. **Dead mobile/dead web code** (no runtime effect): `_handlePayPurchase`
    (`main.dart:694`), `_loadSummary` (`suppliers_screen.dart:74`), `_onSearchChanged`/
    `_onFilterChanged` (`invoice_screen.dart`), no-op `_refreshCurrentSection`
    (`main.dart:1060`), and dead `api_service.dart` methods `deleteProduct`,
    `payUdhaariEntry`, `getLowStockCount`, `getPnlReport`, `getGstReport`.
12. **`GET /api/products/template`** legacy endpoint unused (web uses
    `template.csv`/`template.xlsx`); `POST /api/products/:id/restore` unused (web uses
    the `PATCH /:id/archive` toggle).
