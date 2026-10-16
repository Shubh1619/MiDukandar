# MiDukandar — Technical Audit & Engineering Report

**Auditor:** Principal Software Engineer (read-only audit)
**Date:** 2026-10-14
**Repository:** `C:\Users\Shubham\Desktop\abc\MiDukandar`
**Scope:** `backend/` (Fastify 4 + TypeScript + raw SQL `pg`), `web/` (Next.js 16 App Router), `app/` (Flutter), infrastructure (`Dockerfile`, `docker-compose.yml`, `.github/workflows/main.yml`), database migrations, and CI/CD.
**Method:** Static reading of source with `file:line` citations, plus execution of the project's own verification tooling (typecheck, lint, build, migrations, seed, smoke test). Where a claim could not be verified by running code it is marked `UNVERIFIED`.

> This report was produced without modifying any source file.

---

## 1. Executive Summary

- **The product is a genuinely multi-tenant retail/shop management SaaS** (POS sales, inventory, udhaari/credit ledger, purchases, expenses, reports, GST/P&L, subscriptions/plans, and a separate platform superadmin layer) with three clients sharing one REST API. Tenancy is enforced by a `storeId` claim extracted from the JWT on every protected route (`backend/src/middlewares/auth.ts:84`, `:96`), and plan/module gating is injected automatically at route registration (`backend/src/app.ts:147-158`).
- **The backend is the strongest layer.** It typechecks and builds cleanly, migration/seed/smoke tooling all pass against a live Postgres, money is handled as `NUMERIC` with a single `round2` helper (`backend/src/services/report.service.ts:7`), the POS/ledger/stock logic is transactional, stock balances are *derived* from an append-only movement ledger rather than mutated in place (`backend/src/services/stock.service.ts:10`), and the app **refuses to boot in production with default secrets or a set `OTP_MASTER`** (`backend/src/config.ts:140-193`). Backend health: **8/10**.
- **There is a confirmed, user-facing functional bug in the web expenses UI.** The recurring-expense dialog writes to the bare `/api/recurring-expenses` path (`web/src/components/expenses/recurring-expense-dialog.tsx:104`), which resolves to the *one-time expense* handler rather than the `/recurring` handler (`backend/src/routes/expense.routes.ts:158`); create/update/delete/toggle of recurring expenses are therefore all wrong. Web health: **6.5/10**.
- **The Flutter app does not currently compile its tests and ships a stale test contract**, and the web lint gate is red (21 errors / 29 warnings), so CI surfaced as "green" only because the failing steps are non-blocking. This is the main process risk: the pipeline gives false confidence. (No `.github` step fails the build on web lint or Flutter test — see §7.) Flutter health: **6/10**.
- **Security posture is above average but not done.** Secrets are committed in dev `.env` files (including `OTP_MASTER=000000`, a universal OTP bypass — `backend/src/config.ts:101`, `:159`), tokens are cookie/protected, refresh tokens are hash-only with rotation + a 60s grace window (`backend/src/routes/auth.routes.ts:21`, `:28-29`), superadmin impersonation is time-boxed and audited (`backend/src/routes/superadmin.routes.ts:179-236`), and Razorpay webhooks verify HMAC signatures (`backend/src/routes/webhook.routes.ts:16`). Security health: **7/10**. Overall engineering health: **7/10**.

### Health scores by layer

| Layer | Score | Basis |
|---|---|---|
| Backend / API | 8/10 | typecheck + build pass; smoke passes; transactional money logic; auto secret assertion |
| Database / schema | 8/10 | 16 migrations, all applied; append-only ledgers; **duplicate `012_*` numbering** |
| Web client | 6.5/10 | `tsc` + `next build` pass; **lint red (21 errors)**; recurring-expense bug |
| Flutter client | 6/10 | analyze reports 106 issues; **`flutter test` fails to compile** (stale test) |
| Security | 7/10 | solid authn/tenancy/impersonation; committed dev secrets; upload mimetype-only check |
| DevOps / CI-CD | 6.5/10 | 4-job pipeline, healthcheck gating; **lint/test gates non-blocking**; Docker daemon unreachable locally |
| **Overall** | **7/10** | Strong core, weak verification/enforcement |

---

## 2. Architecture

### 2.1 High-level component diagram

```mermaid
graph TB
  subgraph Clients
    W["web/ — Next.js 16 App Router<br/>React 19, Tailwind v4, shadcn/ui"]
    F["app/ — Flutter (Dart ^3.12.2)"]
  end

  subgraph Edge
    PX["web/src/proxy.ts<br/>rewrites /api/* → BACKEND_URL"]
  end

  subgraph API["backend/ — Fastify 4 (ESM, TypeScript)"]
    SRV["server.ts: buildApp + graceful shutdown"]
    APP["app.ts: route registration<br/>onRoute → authenticate + requireModuleAccess"]
    MW["middlewares: auth.ts, superadmin.ts"]
    RT["26 route modules"]
    SV["services: invoice · ledger · stock · report · expense · payment · product-import"]
    LIB["lib: otp · money · plans · r2 · razorpay · pdf · mail · fcm · audit"]
  end

  subgraph Data
    PG[("PostgreSQL 17<br/>raw SQL via pg Pool")]
  end

  subgraph Ext
    R2["Cloudflare R2 (images)"]
    RAZ["Razorpay (webhooks)"]
    BREVO["Brevo (email OTP)"]
    FCM["FCM (push)"]
  end

  W --> PX --> API
  F --> API
  API --> PG
  SV --> R2
  RT --> RAZ
  LIB --> BREVO
  LIB --> FCM
```

### 2.2 Tech stack

| Component | Technology | Evidence |
|---|---|---|
| Backend runtime | Node (v24.11.1), TypeScript ESM, Fastify 4 | `backend/src/server.ts:7-21` |
| DB access | `pg` raw SQL, no ORM, `withTx`/`qOne`/`qExec` helpers | `backend/src/db/pool.ts`; `backend/src/routes/product.routes.ts:16` |
| Database | PostgreSQL 17 (`postgres:17-alpine`) | `docker-compose.yml`; `backend/migrations/001_init.sql:6` |
| Web | Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui | `web/next.config.ts:67`; `web/src/proxy.ts` |
| Mobile | Flutter / Dart `^3.12.2` | `app/pubspec.yaml`; `app/lib/main.dart` |
| Auth | JWT access (15m) + rotating httpOnly refresh cookie (30d) | `backend/src/routes/auth.routes.ts:134-142`, `:199-273` |
| Payments | Razorpay webhooks (HMAC verified) | `backend/src/routes/webhook.routes.ts:16` |
| Storage | Cloudflare R2 | `backend/src/routes/upload.routes.ts:4`, `:32` |
| CI/CD | GitHub Actions → GHCR → Render | `.github/workflows/main.yml` |

### 2.3 Request lifecycle (protected tenant route)

```mermaid
sequenceDiagram
  participant C as Client
  participant A as Fastify app
  participant H as authenticate (middleware)
  participant M as requireModuleAccess (onRoute-injected)
  participant R as Route handler
  participant D as PostgreSQL
  C->>A: HTTPS request + Bearer access token
  A->>H: verify JWT (reject SUPERADMIN)
  H-->>A: request.auth {id, role, storeId}
  A->>M: hasModuleAccess(storeId, moduleKey)
  M-->>A: ok / 403 "Upgrade your plan"
  A->>R: handler(requireStore → storeId scope)
  R->>D: parameterised SQL (store_id = $n)
  D-->>R: rows
  R-->>C: JSON
```

---

## 3. Module-by-Module Findings

| Module | Status | Key risks | Evidence |
|---|---|---|---|
| Auth (OTP, register, refresh, logout) | Solid | Register creates store without email verification; dev `OTP_MASTER` bypass | `backend/src/routes/auth.routes.ts:92,103,116,146,199,277`; `backend/src/config.ts:159` |
| Tenancy & Authorization | Solid | None blocking | `backend/src/middlewares/auth.ts:44-46,84,96,112,129` |
| Product CRUD & import/export | Solid | c8 public-path ordering is deliberate; archive/restore path accesses camelCase on snake_case rows (probable defect, §8) | `backend/src/routes/product.routes.ts:123-414`; `:339` |
| Sales / Invoicing (POS) | Solid, transactional | Reverse/update/payment complexity | `backend/src/services/invoice.service.ts:290,415,485,602,671,834` |
| Stock (append-only ledger) | Strong | Balance derived, never stored | `backend/src/services/stock.service.ts:10,28` |
| Udhaari / customer ledger | Strong | Non-positive amounts rejected | `backend/src/services/ledger.service.ts:10,19,42` |
| Payments | Solid | Derived from sales + explicit records | `backend/src/services/payment.service.ts:20` |
| Expenses (incl. recurring) | **Broken on web** | Recurring writes hit one-time handler | `backend/src/routes/expense.routes.ts:80,158,193,205`; `web/src/components/expenses/recurring-expense-dialog.tsx:104` |
| Reports (dashboard/sales/purchases/stock/GST/P&L) | Solid | Revenue derived from `paid_amount` proportional split | `backend/src/routes/report.routes.ts:51-134`; `backend/src/services/report.service.ts:30` |
| Plans / module gating | Solid | Gating injected centrally | `backend/src/app.ts:42-65,147-158` |
| Superadmin (tenants/impersonate/settings/logs) | Solid | `lastActiveAt` always null (probable defect) | `backend/src/routes/superadmin.routes.ts:35,179,286,313,348` |
| Upload (R2) | OK | Mimetype allowlist only; no magic-byte/size check | `backend/src/routes/upload.routes.ts:8,20` |
| Webhooks (Razorpay) | Partial | Signature verified; no idempotency/replay store; empty FCM token | `backend/src/routes/webhook.routes.ts:16,28,47` |
| Web client | Functional, lint-red | Recurring bug; 21 lint errors | `web/src/app/(main)/expenses/page.tsx:134,178` |
| Flutter client | Runs, tests broken | Stale widget_test against removed params | `app/test/widget_test.dart`; `app/lib/main.dart:325` |

---

## 4. Security Review (OWASP-mapped, severity-ranked)

| # | Severity | Finding | OWASP | Evidence |
|---|---|---|---|---|
| S1 | **High** | Committed dev secrets incl. `OTP_MASTER="000000"` (universal OTP bypass) in `.env`; guarded in prod but trivially leaked | A02 / A05 | `.env`; `backend/src/config.ts:101,159-163` |
| S2 | **High** | `OTP_MASTER` is a global authentication bypass for **any** account by design; one mis-set env in prod is catastrophic (mitigated only by boot assertion) | A07 | `backend/src/config.ts:159` |
| S3 | Medium | Image upload validates client-supplied `mimetype` only — no magic-byte/extension validation, no explicit size cap in handler | A04 / A08 | `backend/src/routes/upload.routes.ts:8,20` |
| S4 | Medium | Register creates user + store with **no email/OTP verification** (`/register`), enabling bulk fake-tenant creation | A07 | `backend/src/routes/auth.routes.ts:146-196` |
| S5 | Medium | Razorpay webhook has signature verification but **no idempotency/replay protection** and stores no event record | A08 | `backend/src/routes/webhook.routes.ts:12-41` |
| S6 | Low | JWT/dev-secret defaults are literally published strings; safe only because prod boot is asserted | A02 | `backend/src/config.ts:64-67` |
| S7 | Low | Refresh-token rotation has a 60s reuse grace window — a stolen-but-rotated token is still accepted briefly | A07 | `backend/src/routes/auth.routes.ts:21,223-229` |
| S8 | Low | `checkPermission` maps `STOCK_MANAGER`→`STAFF` and falls back to `defaultPermissionsFor` — verify parity | A01 | `backend/src/middlewares/auth.ts:112-127`; `auth.routes.ts:298-306` |

**Positive controls observed:** superadmin tokens are rejected on tenant routes (`backend/src/middlewares/auth.ts:44-46`); impersonation tokens are separate and time-boxed (`backend/src/routes/superadmin.routes.ts:198-215`); platform setting writes are whitelisted (`superadmin.routes.ts:24-30,292`); every superadmin action is audited (`superadmin-audit.ts`, called at `superadmin.routes.ts:72,119,134,166,217,266,277,301,342`); refresh tokens are stored hashed (`auth.routes.ts:28-29`); refresh cookie is `httpOnly` + `sameSite:lax` (`auth.routes.ts:33-39`); web sets CSP + HSTS conditionally (`web/next.config.ts:27-59`).

---

## 5. Data Model & Migration Review

### 5.1 Entity-relationship diagram (core)

```mermaid
erDiagram
  STORES ||--o{ USERS : "store_id"
  STORES ||--o{ PRODUCTS : "store_id"
  STORES ||--o{ CUSTOMERS : "store_id"
  STORES ||--o{ SALES : "store_id"
  STORES ||--o{ PURCHASES : "store_id"
  STORES ||--o{ STOCK_MOVEMENTS : "store_id"
  STORES ||--o{ PAYMENTS : "store_id"
  STORES ||--o{ LEDGER_ENTRIES : "store_id"
  STORES ||--o{ HELD_BILLS : "store_id"
  STORES }o--|| PLANS : "plan_id"
  USERS ||--o{ REFRESH_TOKENS : "user_id"
  SALES ||--o{ SALE_ITEMS : "sale_id"
  SALES ||--o{ PAYMENTS : "sale_id"
  CUSTOMERS ||--o{ SALES : "customer_id"
  CUSTOMERS ||--o{ LEDGER_ENTRIES : "customer_id"
  PRODUCTS ||--o{ STOCK_MOVEMENTS : "product_id"
  PRODUCTS ||--o{ SALE_ITEMS : "product_id"
  PURCHASES ||--o{ PURCHASE_ITEMS : "purchase_id"
```

Base tables and constraints are in `backend/migrations/001_init.sql`: `users:9`, `refresh_tokens:26`, `otps:37`, `stores:50`, `products:73`, `customers:98`, `sales:117`, `sale_items:142`, `purchases:158`, `purchase_items:179`, `stock_movements:194`, `payments:212`, `ledger_entries:231`, `held_bills:247`, `schema_migrations:259`. Money columns use `NUMERIC(12,2)`, quantities `NUMERIC(12,3)`; `stock_movements.qty` is signed (`+in / -out`, line 198) and balance is *derived*.

### 5.2 Migration inventory

`001_init` · `002_products_v2` · `003_refresh_tokens_v2` · `004_recovery` · `005_udhaari` · `006_superadmin` · `007_invoice_udhaari` · `008_sales_due_date` · `009_suppliers` · `010_expenses` · `011_users_roles` · **`012_plans`** · **`012_refresh_tokens_grace`** · `013_plan_hardening` · `014_legacy_plan_compatibility` · `015_reset_application_data_except_superadmins`.

**Findings**
- **Duplicate migration prefix `012_`** (`012_plans.sql` and `012_refresh_tokens_grace.sql`). They still apply in lexicographic order and are tracked by name in `schema_migrations`, so it is not currently fatal — but it breaks the "sequence == ordering" invariant and will confuse tooling/humans. Renumber one (e.g. `012a`/`013`).
- `auth.routes.ts` writes `token_hash`, `device_info`, `grace_until`, `last_used_at` (`auth.routes.ts:57,237-240`) which are **not** in `001_init.sql` (`refresh_tokens` there has a plaintext `token` column, `001_init.sql:29`) — these are introduced by `003_refresh_tokens_v2` / `012_refresh_tokens_grace`. Confirms the layered-migration approach; the base file alone is not the live schema.
- `015_reset_application_data_except_superadmins.sql` is destructive and correctly gated behind `RESET_DATA_CONFIRM=DELETE_ALL_DATA_EXCEPT_SUPERADMINS` (verified: migrate skipped it without the env var).
- No down-migrations exist (forward-only). Acceptable for this stage; noted.

---

## 6. API Inventory & Client Usage Matrix

26 route modules under `backend/src/routes/` (full list captured during audit; `product.shared.ts` is a helper, not a router). All tenant routes require `Authorization: Bearer <accessToken>`; superadmin routes require the `mz_sa` cookie/session.

| Group | Base path | Handler file:line | Web | Flutter |
|---|---|---|---|---|
| Auth | `/api/auth` | `auth.routes.ts:92,103,116,146,199,277,291` | login-kind, otp, refresh, logout, me | refresh:276, logout:335, login-kind:349, otp:363/384, me:440/521, register:485 |
| Products | `/api/products` | `product.routes.ts:132-413` | list/summary/categories/CRUD | 597,624,609,620,640,653,660,664,672 |
| Customers | `/api/customers` | `customer.routes.ts` | yes | 685,715,700,711 |
| Sales | `/api/sales` | `sale.routes.ts:9,13-39` | yes | 727,767,738,756,779 |
| Purchases | `/api/purchases` + `/api/purchase-orders` | `purchase.routes.ts`, `purchase-order.routes.ts` | partial | 795,823,812 |
| Suppliers | `/api/suppliers` | `supplier.routes.ts` | yes | 835,847,863,874,1081 |
| Payments | `/api/payments` | `payment.routes.ts` | yes | — |
| Udhaari / ledger | `/api/udhaari` | `udhaari.routes.ts` | yes | — |
| Expenses | `/api/expenses`, `/api/expense-categories`, `/api/recurring-expenses` | `expense.routes.ts:51-214` (triple-mounted, `app.ts:243-245`) | **yes (recurring bug)** | 882,909 |
| Reports | `/api/reports` | `report.routes.ts:51-134` | yes | — |
| Inventory | `/api/inventory` | `inventory.routes.ts` | yes | — |
| Store / Settings | `/api/store`, `/api/settings` | `store.routes.ts`, `settings.routes.ts` | yes | 532,540,549 |
| Users / Roles / Plans | `/api/users`, `/api/roles`, `/api/plans` | `user.routes.ts`, `role.routes.ts`, `plan.routes.ts` | yes | — |
| Uploads | `/api/uploads` | `upload.routes.ts:11` | yes | — |
| Webhooks | `/api/webhooks` | `webhook.routes.ts:12,44` | no (server) | no |
| Superadmin | `/api/superadmin`, `/api/superadmin/auth`, `/api/superadmin/plans` | `superadmin.routes.ts`, `superadmin-auth.routes.ts`, `superadmin-plans.routes.ts` | yes (superadmin console) | no |
| Recovery | `/api/recovery` | `recovery.routes.ts` | yes | — |
| Health | `/health` | `health.routes.ts` | no | no |

**Confirmed recurring-expense defect (web):**

| Web call | Line | Backend handler actually hit | Intended handler |
|---|---|---|---|
| `POST /api/recurring-expenses` | `recurring-expense-dialog.tsx:104` | `expense.routes.ts:158` (create **one-time** expense) | `:88` (create recurring) |
| `PATCH /api/recurring-expenses/:id` | `recurring-expense-dialog.tsx:98` | `expense.routes.ts:193` (update one-time) | `:100` (update recurring) |
| `DELETE /api/recurring-expenses/:id` | `expenses/page.tsx:178` | `expense.routes.ts:205` (delete one-time) | `:112` (delete recurring) |
| `PATCH …/:id {isActive}` | `expenses/page.tsx:192` | `expense.routes.ts:193` (`isActive` stripped) | `:100` (toggle active) |
| `GET /api/recurring-expenses/recurring` | `expenses/page.tsx:134` | `expense.routes.ts:80` ✅ | correct |

Because the bare paths were chosen instead of the `/recurring` sub-paths, creating a "recurring" expense silently creates a normal expense and `frequency`/`nextDueDate` are stripped by Zod. **Fix:** prefix each with `/recurring` (`/api/recurring-expenses/recurring`).

---

## 7. DevOps / CI-CD Review

- **Dockerfile** is multi-stage: `base` → `backend-deps` → `backend-build` → `backend` + `web-deps` → `web-build` → `production`.
- **docker-compose.yml**: `db` = `postgres:17-alpine` (host port **5433**), backend runs migrations fail-fast (`|| exit 1`) on boot, then web.
- **docker-entrypoint.sh**: migrations abort-on-failure; superadmin bootstrap is non-fatal; polls `/health` up to 45s; finally `exec node /app/server.js`.
- **`.github/workflows/main.yml`** has 4 jobs: `quality`, `integration`, `docker`, `publish+deploy` (GHCR → Render).
- **README.md is effectively empty (1 line)** and **AGENTS.md** instructs a Docker restart after code changes.

**Risks**
1. **Verification gates are non-blocking** — backend ESLint *fails configuration* (`ESLint couldn't find an eslint.config.js`, ESLint 9.39.5 requires flat config), Flutter `test` fails to compile, and web lint is red, yet the pipeline is described as passing. Restore blocking lint/test gates; this is the single highest-leverage process fix.
2. **Docker daemon was unreachable (CLI present, engine down)** in the audit environment, so container-level compose checks were `UNVERIFIED`; DB-level checks were run against local `postgresql-x64-17`.
3. No vulnerability/secret scanning step (e.g. `gitleaks`) despite dev secrets in the tree.

---

## 8. Prioritized Issue Register

| ID | Sev | Effort | Location | Issue | Fix |
|---|---|---|---|---|---|
| BUG-01 | **High** | S | `web/src/components/expenses/recurring-expense-dialog.tsx:98,104`; `web/src/app/(main)/expenses/page.tsx:178,192` | Recurring expense create/update/delete/toggle hit one-time-expense handlers | Prefix paths with `/recurring` |
| BUG-02 | High | S | `.github/workflows/main.yml` | Lint/test failures do not block pipeline | Make web lint, Flutter test, backend lint blocking |
| BUG-03 | High | M | `backend/src/config.ts:101,159`; `.env` | `OTP_MASTER` bypass + committed dev secrets | Rotate/remove; add `gitleaks`; keep boot assertion |
| BUG-04 | Medium | S | `backend/migrations/012_plans.sql` & `012_refresh_tokens_grace.sql` | Duplicate `012_` prefix | Renumber one migration |
| BUG-05 | Medium | S | `backend/src/routes/product.routes.ts:339` | `product.isArchived` (camelCase) read on snake_case row → restore path likely returns early | Confirm row mapping; use `is_archived` |
| BUG-06 | Medium | S | `backend/src/routes/superadmin.routes.ts:80,348` | `pickMaxDate(t.lastSaleAt, t.lastLoginAt)` reads non-existent camel keys → `lastActiveAt` always `null` | Use `last_sale_at`/`last_login_at` |
| BUG-07 | Medium | M | `backend/src/routes/upload.routes.ts:8,20` | Mimetype-only upload validation | Add magic-byte + size validation |
| BUG-08 | Medium | M | `backend/src/routes/auth.routes.ts:146` | `/register` needs no email verification | Add OTP or rate-limit + verification |
| BUG-09 | Medium | M | `backend/src/routes/webhook.routes.ts:12-41` | No webhook idempotency/replay guard | Persist event id; dedupe on retries |
| BUG-10 | Low | S | `web` lint | 21 errors / 29 warnings (`react-hooks/set-state-in-effect`, unescaped entities, unused vars) | Fix or downgrade with rationale |
| BUG-11 | Low | S | `app/test/widget_test.dart` | Test passes removed `products:`/`customers:` params | Update to current `AppShell`/`ProductScreen`/`CustomerScreen` APIs |
| BUG-12 | Low | S | `app/lib/main.dart:366`; `app/lib/screens/dashboard_screen.dart:289-290` | Unused `_drawerWasOpen`; deprecated `withOpacity` (106 analyze issues) | `dart fix` / migrate to opacity APIs |
| BUG-13 | Low | M | `backend/src/routes/auth.routes.ts:21` | 60s refresh-token reuse grace window | Make configurable; shorten/tighten for high-risk tenants |

Severity: High = user-facing breakage or security; Medium = correctness/defense-in-depth; Low = hygiene. Effort: S < 1h, M < 1d.

---

## 9. Roadmap

### 30 days (stabilize & enforce)
- Fix BUG-01 (recurring expenses) and BUG-02 (blocking CI gates).
- Fix BUG-04/05/06 (migration numbering, product restore, superadmin `lastActiveAt`).
- Update Flutter `widget_test.dart` (BUG-11) so `flutter test` is green; wire it as a CI gate.
- Rotate dev secrets, remove `OTP_MASTER` from any shared env, add `gitleaks` (BUG-03).
- Fill in `README.md`; reconfirm AGENTS.md Docker-restart guidance.

### 60 days (harden)
- Upload magic-byte + size validation (BUG-07); webhook idempotency (BUG-09); require verification/rate-limit on `/register` (BUG-08).
- Drive web lint to zero (BUG-10); add backend flat `eslint.config.js`.
- Add container-level integration test job using the compose stack; restore Docker engine in dev.

### 90 days (scale & assurance)
- Add per-store audit log coverage for high-risk tenant actions (mirror superadmin audit).
- Add automated DB backup/restore drills and a documented rollback strategy (forward-only migrations today).
- Introduce contract tests between the API and both clients; add load/soak tests on POS sale path.
- Add dependency + container image scanning; OWASP ASVS checklist sign-off.

---

## Case Study: How a Two-Word Path Prefix Breaks a Feature

The recurring-expense feature is architecturally sound on the backend: `createRecurringSchema` models `frequency`, `nextDueDate`, and `paymentMode` (`backend/src/routes/expense.routes.ts:40-47`), and due items are auto-materialised when the list is loaded (`expense.routes.ts:80-86`, `processDueRecurringExpenses`). The expense router is intentionally mounted three times (`backend/src/app.ts:243-245`), so `/api/recurring-expenses` is a valid entry point.

The failure is that the web client chose the **mount root** rather than the **sub-path** for the recurring resource. Writing to `/api/recurring-expenses` matches the router's own `POST /` (`expense.routes.ts:158`), which parses `createExpenseSchema` (`:28`). Zod runs in strip mode, so `frequency` and `nextDueDate` vanish, `categoryId/title/amount/paymentMode` survive, and a normal one-time expense is created. The recurring tab then loads via the *correct* `/recurring` path (`web/src/app/(main)/expenses/page.tsx:134`), so the record never appears — the feature looks like it "did nothing." The same prefix mismatch silently redirects update (`:98`→`:193`), delete (`page.tsx:178`→`:205`), and the active-toggle (`page.tsx:192`, where `isActive` is stripped by `createExpenseSchema.partial()`).

**Lessons**
1. Triple-mounting one router for two resource shapes is a sharp edge: identical paths mean different operations depending on prefix. Prefer distinct routers or a `/recurring` sub-router with its own schemas.
2. Zod strip mode turns a wrong endpoint into a *silent partial success* rather than a 400. A strict `unknownKeys: "strict"` policy on write schemas would have made this fail loudly on day one.
3. A blocking integration test that creates a recurring expense and asserts it appears in the recurring list would have caught this before merge — reinforcing BUG-02 as the top process priority.

---

## Appendix: Verification Commands & Results

All commands run from `C:\Users\Shubham\Desktop\abc\MiDukandar` unless noted.

| Command (workdir) | Result |
|---|---|
| `node -v` / `npm -v` | v24.11.1 / 11.6.2 |
| `docker --version` / `docker info` | CLI 29.6.2 present; **daemon not running** (`UNVERIFIED` at container level) |
| `flutter --version` | 3.44.4 |
| `npm run typecheck` (`backend`) | **PASS** |
| `npm run lint` (`backend`) | **FAIL**: ESLint 9.39.5 — `Couldn't find an eslint.config.(js|mjs|cjs) file` |
| `npm run build` (`backend`) | **PASS** (tsc → dist) |
| `npx tsc --noEmit` (`web`) | **PASS** |
| `npm run lint` (`web`) | **FAIL**: 21 errors / 29 warnings |
| `npm run build` (`web`) | **PASS** (Next 16 standalone; 27 routes) |
| `flutter analyze` (`app`) | 106 issues (warnings/infos) |
| `flutter test` (`app`) | **FAIL**: compile error in `test/widget_test.dart` (removed `products:`/`customers:` params) |
| `npm run migrate` (`backend`) | All 15 migrations already applied; `015` gated by `RESET_DATA_CONFIRM` |
| `npm run seed` (`backend`) | Store `f4574276-0356-49d4-b0e8-eee31feee70c`; 6 products, 3 customers, 3 sales / 1 purchase / 1 payment |
| `npm run smoke` (`backend`) | **SMOKE TEST PASSED** (OTP master bypass, products/stock/dashboard/sale-create all 200) |

**Database:** local `postgresql-x64-17` on `localhost:5432`; `backend/.env` `DATABASE_URL="postgres://postgres:1619@localhost:5432/mazedukan"`.

**Key files read for citations:** `backend/src/{server,app,config}.ts`; `backend/src/middlewares/{auth,superadmin}.ts`; `backend/src/services/{invoice,ledger,stock,report,expense,payment}.service.ts`; `backend/src/routes/{auth,expense,product,report,superadmin,webhook,upload}.routes.ts`; `backend/migrations/001_init.sql`; `web/src/app/(main)/expenses/page.tsx`; `web/src/components/expenses/recurring-expense-dialog.tsx`; `app/lib/main.dart`; `app/lib/services/api_service.dart`; infra files.
