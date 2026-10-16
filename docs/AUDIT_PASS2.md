# MiDukandar — Second-Pass Security & Correctness Audit

- **Date:** 2026-10-15
- **Scope:** `backend/` (Fastify + Postgres), `web/` (Next.js), `app/` (Flutter), `backend/ENDPOINTS.md`
- **Method:** source review + runtime reproduction against the local dev DB (`postgresql-x64-17`, PostgreSQL 17.7) using an in-process Fastify harness (`app.inject`, concurrent `Promise.all`), plus node one-liners and `psql`. All findings below cite `file:line`. Claims are marked **VERIFIED** (reproduced) or **STATIC/UNVERIFIED`.
- **Prior work:** first-pass findings live in `docs/AUDIT_FINDINGS.md`; the fix list (#1–#7) and the supplier-invoice feature are complete.

## Environment / seed data

| Item | Value |
|---|---|
| Postgres | 17.7 (`localhost:5432`, db `mazedukan`) |
| Tenant A | `owner@midukandar.demo`, user `95b4403b-32a9-4860-9b60-6267441882ce`, store `f4574276-0356-49d4-b0e8-eee31feee70c`, plan **Free** (price 0/0, default), `plan_status=TRIAL` |
| Tenant B | `owner@mazedukan.demo`, user `713df1ee-2d26-4d6c-9255-270eb82e6f7a`, store `e9f8f5c3-ba70-4e63-9d36-15da3ac41885`, plan **Pro**, `plan_status=ACTIVE` |
| Superadmin | `super_admins` table empty (none seeded) |
| `OTP_MASTER` | `000000` set in dev (prod boot assertion rejects it) |

Enabled plan modules (from `plan_modules.enabled`):

| Plan | Enabled modules |
|---|---|
| Free | BILLING, CUSTOMERS_UDHAARI, DASHBOARD, INVENTORY, PRODUCTS, SALES_INVOICES |
| Pro | + EXPENSES, GST_REPORTS, PURCHASES, SUPPLIERS, USERS_ROLES, WHATSAPP_SHARING |
| Enterprise | + ADVANCED_ANALYTICS, API_ACCESS, BARCODE_HARDWARE (MULTI_STORE not enabled) |

## Coverage matrix

| Area | Items inspected | Items with findings |
|---|---|---|
| 1. Tenant isolation / IDOR | 15 `:id` routes + child tables (customer/product/sale/held-bill) via A-vs-B token matrix; FK-in-body; superadmin-vs-tenant | 1 low (P2-12); no exploitable IDOR |
| 2. Races / transactions | concurrent createSale ×20, last-unit oversell, concurrent full-pay, `getNextNumber`/`assertStock`/`FOR UPDATE`, webhook idempotency | 2 (P2-02, P2-04) |
| 3. Import / file handling | CSV/XLSX export, `/products/import*`, `/uploads/image`, `xlsx.ts`, `pdf-extract.ts`, `r2.ts` | 3 (P2-05, P2-06, P2-07) + 1 false positive corrected |
| 4. Plan gating | full route↔`PLAN_ROUTE_MODULES` diff (101 routes), bypass variants, plan_status semantics | 2 low (P2-13, P2-14) + 1 out-of-scope disclosure (P2-08) |
| 5. OTP / auth abuse | OTP limits, enumeration, master OTP, reset-token replay, refresh rotation, rate-limit key | 3 (P2-09, P2-10, P2-11) |
| 6. Performance | index coverage per tenant query, N+1, pagination, EXPLAIN | 1 low (P2-17) |
| 7. Contract diff | backend routes vs `ENDPOINTS.md` vs web `apiFetch` vs Flutter `api_service.dart` | 3 (P2-01, P2-03, P2-16) |

---

## Findings

Severity: **High** = broken feature / data-integrity / auth impact; **Medium** = security/DoS/info-disclosure; **Low** = hygiene/correctness.

### P2-01 — Flutter calls a supplier-invoice URL that does not exist (404) · High · Contract
`app/lib/services/api_service.dart:881`
```dart
final data = await _request('/api/suppliers/invoice', method: 'POST', body: payload);
```
Backend registers `POST /api/suppliers/:id/invoice` (`backend/src/routes/supplier.routes.ts:310-312`) — there is no `/api/suppliers/invoice`. Callers: `app/lib/screens/...` → `app/lib/main.dart:1065-1080`.

**Repro (VERIFIED):** `POST /api/suppliers/invoice` with tenant B token → `404`. The mobile supplier-invoice flow cannot succeed.
**Fix:** include the supplier id in the path (`/api/suppliers/$id/invoice`) or add a route that resolves the supplier from the payload.

### P2-02 — Supplier invoice endpoint always 500s (`withTx` passed as a DbClient) · High · Backend
`backend/src/routes/supplier.routes.ts:369`
```ts
const purchase = await createPurchase(withTx as any, input);
```
`withTx` is a function; `createPurchase` calls `db.qOne(...)` → `invoice.service.ts:148` (`getNextNumber`) throws `TypeError: db.qOne is not a function`.

**Repro (VERIFIED):** `POST /api/suppliers/<id>/invoice` with `{lines:[{productName:"X",qty:1,unitPrice:10}]}` → `500 UNKNOWN`.
**Fix:** `await withTx((tx) => createPurchase(tx, input))`.

### P2-03 — Flutter sale-update payload omits required `lines` (400) · High · Contract
`app/lib/screens/invoice_screen.dart:454-467` builds `{customer, paymentMode, paidAmount, notes}`; `backend/src/routes/sale.routes.ts:29-44` `saleSchema` requires `lines` (`.min(1)`), `paymentMode`, etc.

**Repro (VERIFIED):** `PUT /api/sales/<id>` with that payload → `400 BAD_REQUEST` (`VALIDATION_ERROR`). Editing an invoice from the app fails.
**Fix:** send the full sale body (fetch + merge the sale's `lines`) or relax the backend schema for partial updates.

### P2-04 — Webhook idempotency key is `event_id` only · High · Correctness/Security
`backend/src/routes/webhook.routes.ts:13-33`
```ts
event_id TEXT PRIMARY KEY
...
INSERT INTO webhook_events (event_id, payload) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING
```
`isProcessed` filters `event_id AND payload->>'entity_id'`, but the write de-duplicates on `event_id` alone. The **second** distinct entity under the same event name is never recorded, so `isProcessed` keeps returning false and it is reprocessed forever.

**Repro (VERIFIED, SQL):** insert `(pay.captured, entity_id=pay_A)` → then `isProcessed(pay.captured, pay_B)` is false; inserting `pay_B` yields `INSERT 0 0` and the stored payload stays `pay_A`; still false afterwards.
**Fix:** `PRIMARY KEY (event_id, entity_id)` (or a `UNIQUE (event_id, (payload->>'entity_id'))`), and insert with that conflict target.

### P2-05 — Upload magic-byte signatures are wrong · Medium · Security
`backend/src/routes/upload.routes.ts:16-20`
```ts
const isPng = h[0] === 0x89 && h[1] === 0x98 && h[2] === 0x50 && h[3] === 0x71; // real: 89 50 4E 47
const isGif = h[0] === 0x4E && h[1] === 0x7F && h[2] === 0x71 && h[3] === 0x6E; // real: 47 49 46 38
const isJpeg = h[0] === 0xFF && h[1] === 0xFF;                                  // real: FF D8
```
**Repro (VERIFIED, node):** real PNG/JPEG/GIF/WEBP → **REJECT**; junk `FF FF 00 00` → **ACCEPT**.
**Fix:** correct the constants (PNG `89 50 4E 47`, GIF `47 49 46 38`, JPEG `FF D8`, WEBP `52 49 46 46....57 45 42 50`) or use a library.

### P2-06 — R2 object key injection via `entity` + filename extension · Medium · Security
`backend/src/routes/upload.routes.ts:30,55` (`entity` unvalidated; `part.filename` client-controlled) → `backend/src/lib/r2.ts:42-43`
```ts
const ext = opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
const key = `${opts.storeId}/${opts.entity}/${Date.now()}-${cryptoRandomBase36()}.${ext}`;
```
`entity` may contain `/` and `..`; a filename without a dot makes `ext` the whole string (verified: `"a/../../../../x"` → `ext="a/../../../../x"`). The returned URL (`r2.ts:54-55`) is `base + "/" + key`; a normalizing client/CDN resolves the `..` segments outside the intended `storeId/` prefix.
**STATIC/UNVERIFIED:** not exploitable in this environment (R2 unconfigured → `503` before keying). Impact depends on the CDN/consumer normalizing the URL.
**Fix:** allow-list `entity`; derive `ext` from the validated mimetype, not the filename; reject `/ \ .. NUL`.

### P2-07 — PDF import: catastrophic regex + unbounded inflate · Medium · DoS
`backend/src/lib/pdf-extract.ts:284` (and `:305`)
```ts
const streamRe = /<<([^>]*(?:>[^<]+)*?)\s*(?:\/Length\s+\d+\s*)?stream\r?\n/g;
```
`backend/src/lib/pdf-extract.ts:14,16` call `inflateSync`/`inflateRawSync` with no `maxOutputLength`; page count is never capped.

**Repro (VERIFIED, node):** the regex is exponential — 12→0ms, 20→4ms, 22→14ms, doubling per +2 chars (n≈40 is minutes; agent measured >120 s at n=200). `POST /api/products/import/pdf` (auth+manager; ≤5 MB upload) with `"<<" + ">a"×N` and a `.pdf` filename hangs a core. A ≤5 MB flate bomb also expands without limit.
**Fix:** bound `inflate(..., { maxOutputLength })`, cap total decoded bytes/pages, and replace the regex with a linear scanner.

### P2-08 — Unauthenticated merchant disclosure (recon) · Medium · Info disclosure
`backend/src/routes/recovery.routes.ts:186-227`
```ts
app.get("/verify-context", async (request) => {   // no authenticate
  const { mobile } = parse(mobileQuerySchema, request.query);
```
**Repro (VERIFIED):** `GET /api/merchant/verify-context?mobile=9876543210` (no Authorization) → `200` with `storeName`, `city`, `ownerName`, `gstin`, `terminalId`, today's invoice/receipt counts, and total pending udhaari. Enumerable by phone number.
**Fix:** require authentication, or return only a boolean "matches" without business data.

### P2-09 — User enumeration on auth/recovery · Medium · Info disclosure
`backend/src/routes/auth.routes.ts` (`otp/request` unknown email → `404 ACCOUNT_NOT_FOUND`; `register` existing → `409`), `backend/src/routes/recovery.routes.ts:66,82` (unknown → `404`).
**Repro (VERIFIED):** unknown email OTP request → `404 ACCOUNT_NOT_FOUND`; known → `200`; register existing email → `409`.
**Fix:** uniform responses/202 for request endpoints.

### P2-10 — PIN-reset token is replayable (not single-use) · Medium · Auth
`backend/src/routes/recovery.routes.ts:133-182` — `resetToken` is a 10-minute JWT signed with the access secret; `reset-pin` never records it as consumed.
**Repro (VERIFIED):** `POST /api/auth/recovery/reset-pin` with the same token twice → `200` then `200`.
**Fix:** store a one-time jti/token hash and reject reuse (invalidating on first success).

### P2-11 — No per-route rate limits on auth/recovery/OTP · Medium · Abuse
`backend/src/app.ts:132-143` registers only the global limiter (default 100 req / 15 min / IP, `config.ts:122-124`); superadmin auth has a stricter 10/min scope. `/api/auth/*`, `/api/auth/recovery/*`, `/api/register`, `/api/auth/otp/*` have no per-route override; OTP has a per-email cap (5/10 min) but no per-IP or per-phone cap.
**Repro (VERIFIED):** same email, 6 OTP requests → 6th returns `OTP_RATE_LIMITED`; unique emails are unbounded up to the global IP limit.
**Fix:** add tighter per-route limits keyed on IP + identifier (phone/email).

### P2-12 — Cross-tenant `DELETE /api/sales/held/:id` answers 200 without deleting · Low · Correctness
`backend/src/routes/sale.routes.ts:354` runs the delete with `WHERE store_id = $2` and returns `{ok:true}` regardless of rows affected.
**Repro (VERIFIED):** tenant A deletes tenant B's held bill → `200`; B still reads it → `200` (no IDOR — the store filter holds). Misleading success only.

### P2-13 — Plan modules defined but never enforced on routes · Low · Plan gating
`backend/src/lib/plans.ts:9-26` defines WHATSAPP_SHARING / ADVANCED_ANALYTICS / MULTI_STORE / BARCODE_HARDWARE / API_ACCESS, but `PLAN_ROUTE_MODULES` (`app.ts:42-60`) maps no path to them. E.g. `GET /api/suppliers/:id/reorder-message` (`supplier.routes.ts:377`) is gated by SUPPLIERS only; a plan with SUPPLIERS=on, WHATSAPP_SHARING=off still returns the WhatsApp deep-link. STATIC.

### P2-14 — Free (price-0) plans skip `plan_status` · Low · Plan gating
`backend/src/lib/plans.ts:196` — `(price_monthly=0 AND price_yearly=0) OR (plan_status IN ...)`. A Free tenant's module access ignores SUSPENDED/EXPIRED/CANCELED `plan_status` (still requires `stores.status='ACTIVE'` and `plans.status='ACTIVE'`). Appears intentional. STATIC.

### P2-15 — Expense routes double-mounted; docs overcount · Low · Hygiene
`backend/src/app.ts:241-243` registers `expenseRoutes` at both `/api/expenses` and `/api/expense-categories` (one-time CRUD reachable under the latter). `backend/ENDPOINTS.md` claims "14 routes × 3 prefixes = 42"; actual is 14+14+5 = 33. STATIC.

### P2-16 — API docs drift · Low · Docs
`backend/ENDPOINTS.md` is missing `POST /api/suppliers/:id/invoice`, `POST /api/superadmin/auth/logout`, the superadmin plans routes (`superadmin-plans.routes.ts`), `PATCH /api/superadmin/tenants/:id/plan`, and public `GET /api/plans`. Its recurring-expense "bug" note is stale (web calls match the real registrations). STATIC.

### P2-17 — Missing composite indexes (perf) · Low · Performance
Present and sufficient: `sales(store_id, created_at DESC)` (`idx_sales_store`), `payments(store_id, created_at DESC)`, `udhaari_entries(store_id, entry_date DESC)`, `supplier_payments(store_id, supplier_id, payment_date DESC)`. Recommended (static, no EXPLAIN — dataset is tiny):
```sql
CREATE INDEX IF NOT EXISTS idx_sales_store_status   ON sales(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_store_overdue  ON sales(store_id, created_at) WHERE status='CONFIRMED' AND due_amount > 0;
CREATE INDEX IF NOT EXISTS idx_udhaari_payments_store_created ON udhaari_payments(store_id, created_at DESC);
-- webhook_events should get UNIQUE (event_id, entity_id) per P2-04
```
No unpaginated list endpoints found (all clamp `limit` ≤ 200 via `paginationSchema`, `validate.ts:14`). No confirmed N+1 outside small in-transaction loops.

### P2-18 — XLSX writer emits malformed local file headers · Low · Correctness
`backend/src/lib/xlsx.ts:146-156` writes the name at offset 28 (spec wants the 2-byte extra-length there, name at 30). Excel still opens it via the central directory. Not security-relevant.

### P2-19 — `OTP_MASTER` active in dev · Info
**VERIFIED:** master code `000000` logs in any account in dev. Guarded in prod by `config.ts:159-163` (boot throws if set). Keep unset in production.

---

## Checked, no issue

- **IDOR:** all inspected `:id` routes filter `store_id`; A→B reads/writes/deletes return `404` (customer, product, product adjust, sale, sale invoice/pdf/pay/reverse, held bill GET); cross-store `productId` in `POST /api/sales` → `400 INVALID_PRODUCT`; tenant token → `/api/superadmin/tenants` → `401`. (VERIFIED, `audit-pass2.ts`)
- **Invoice-number race:** 20 concurrent `createSale` → 20 unique invoice numbers (`getNextNumber` is an atomic `UPDATE ... RETURNING`). (VERIFIED)
- **Oversell race:** stock=1, 2 concurrent sales → exactly 1 success (`201,409`). (VERIFIED)
- **Overpayment race:** CREDIT sale + 3 concurrent full pays → 1 success, paid==total, due==0 (`FOR UPDATE`). (VERIFIED)
- **Plan-gating bypass:** duplicate/trailing-slash/case/encoded variants (`/api/expenses/`, `/api/Expenses`, `/api/EXPENSES`, `/api/expenses%2f`, `/api/./expenses`) all blocked (`403`/`404`); `onRoute` appends `requireModuleAccess` after auth/role; `hasModuleAccess` fails closed; `/api/users/invite/accept` does its own in-handler check. (VERIFIED + static diff)
- **Rate-limit key:** anchored on the TCP peer address; `X-Forwarded-For` honoured only from trusted proxy hops (`rate-limit-key.ts:29-34`) — header rotation cannot mint buckets.
- **Formula injection:** XLSX exports write user strings as typed shared strings (`xlsx.ts:248,263,55-57`); no product/customer CSV export; no import-side eval. (VERIFIED)
- **Oversize:** global `bodyLimit` 5 MB (`app.ts:76`) + multipart `fileSize:5MB, files:1` (`app.ts:144`) + `/uploads` re-check. (VERIFIED)
- **SSRF:** the Sheets importer hardcodes `docs.google.com` and constrains the id to `[a-zA-Z0-9_-]+` (`product-import.routes.ts:277-283`). (VERIFIED)
- **Refresh rotation:** old token revoked, new inserted atomically; reuse outside the grace window rejected; in-body refresh token not echoed (`auth.routes.ts:235-272`). Grace-window replay is by design.

---

## Corrections to earlier/agent claims (false positives)

| Claim | Verdict | Evidence |
|---|---|---|
| `product.isArchived` always truthy | **FALSE POSITIVE** | `db/pool.ts` `toCamel` emits both `is_archived` and `isArchived`; keys seen: `["isArchived","is_archived","lastLoginAt","last_sale_at",...]` |
| superadmin `lastActiveAt` always truthy | **FALSE POSITIVE** | same dual-emit |
| `sales` lacks `(store_id, created_at)` | **FALSE POSITIVE** | `idx_sales_store ON sales(store_id, created_at DESC)` exists |
| Import with `purchasePrice:1e999` → 500, aborts batch | **FALSE POSITIVE** | PG17 `numeric` accepts `'Infinity'`; `POST /api/products/import` → `200 {imported:1}` (VERIFIED) |

## UNVERIFIED

- **P2-06** runtime path-escape (R2 not configured → `503`); confirmed statically only.
- **P2-17** index impact — no `EXPLAIN ANALYZE` at 10k rows (dev DB has ~15 sales); recommendations are static.
- **Docker/CI** container verification — daemon down; local Postgres used instead.

## Appendix

**Scripts written**
- `backend/scripts/audit-pass2.ts` — in-process harness (`app.inject`, concurrent `Promise.all`): IDOR matrix, invoice-number/oversell/overpayment races, plan gating + bypass variants, OTP enumeration, master OTP, per-email limit, reset-token replay; best-effort cleanup. Output: 37 checks (30 PASS, plus ENUMERABLE×2, ACTIVE, REPLAYABLE, BUG).
- `backend/scripts/verify-extra.ts` — confirmed P2-01 (404), P2-02 (500), P2-03 (400), and the Infinity false positive (200); cleaned up its rows.

**Commands**
```powershell
# from backend/
npx tsx scripts/audit-pass2.ts
npx tsx scripts/verify-extra.ts
# DB
$env:PGPASSWORD=1619; & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d mazedukan -f cleanup.sql
```

**Artifacts**: `%TEMP%\opencode\webhook_repro.sql`, `%TEMP%\opencode\magic.mjs`, `%TEMP%\opencode\cleanup.sql`, `%TEMP%\opencode\audit_pass2.out.txt`.

**Cleanup:** all throwaway rows removed — `AUDIT-PASS2*` sales=0, `AUDIT2*` products/customers=0, `VX*/VERIFY*` suppliers=0, `boom*` products=0, `held_bills` test rows=0 (total sales back to the 15-row seed baseline).
