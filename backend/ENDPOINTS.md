# MiDukandar Backend — Endpoint Reference

**Stack:** Fastify (TypeScript), JWT Bearer auth, Zod validation (400 `VALIDATION_ERROR` on failure).
**Global rules:** `authenticate` = JWT (rejects SUPERADMIN tokens) + requires `storeId`; `requireRole(...)` always lets **OWNER** through; pagination = `page≥1 (def 1)`, `limit 1–200 (def 50)`; JSON body max 5MB; multipart max 5MB/1 file.

Route registration source: `backend/src/app.ts:154-181`.

---

## 1. Auth — `/api/auth` (auth.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/api/auth/login-kind` | none | `identifier: string` (req, 3–320) |
| POST | `/api/auth/otp/request` | none | `email: string` (req, email), `purpose?: "LOGIN"\|"REGISTER"` (def `"LOGIN"`) |
| POST | `/api/auth/otp/verify` | none | `email` (req), `otp: string` (req, 4–8), `purpose?: "LOGIN"\|"REGISTER"` → returns `{accessToken, expiresInSeconds:900, user}` + refresh cookie |
| POST | `/api/auth/register` | none | `email` (req), `ownerName` (req, 2–80), `name` (req, store, 2–120), `type` (req, 1–60), `address?` (≤300, def `""`), `city?`, `state?` (≤60), `pincode?` (≤10), `phone?` (≤15), `gst?` (≤25), `currency?` (def `"INR"`), `language?` (def `"hi"`), `invoicePrefix?` (def `"INV"`) → 201 |
| POST | `/api/auth/refresh` | none | `refreshToken?: string` (≥10) or refresh cookie → rotates token |
| POST | `/api/auth/logout` | none | `refreshToken?: string` or cookie → `{ok:true}` |
| GET | `/api/auth/me` | JWT | — → `{user(+permissions), store}` |

### Recovery — `/api/auth/recovery` (recovery.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/api/auth/recovery/initiate` | none | `method?: "mobile"\|"email"` (def `"mobile"`), `mobile?` (4–20), `email?` (email) — matching one required by method |
| POST | `/api/auth/recovery/verify-otp` | none | `identifier?`, `mobile?` (≥1 of them req), `otp` (req, 4–8) → `{resetToken, expiresInSeconds:600}` |
| POST | `/api/auth/recovery/reset-pin` | none | `resetToken` (req, ≥10), `newPin` (req, `/^\d{4,8}$/`), `confirmPin` (req, same, must match; weak PINs rejected) |

### Merchant — `/api/merchant`

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/api/merchant/verify-context` | none | Query: `mobile: string` (req, 4–20) |

---

## 2. Health — `/health` + `/api/health` (health.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` (both prefixes) | none | — → `{status, service, time}` |
| GET | `/ready` (both prefixes) | none | — → 200 ready / 503 degraded |

---

## 3. Superadmin

### Auth — `/api/superadmin/auth` (rate limit 10/60s)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/api/superadmin/auth/login` | none | `email` (req), `password` (req, 8–200) |
| GET | `/api/superadmin/auth/me` | requireSuperAdmin | — |

### Admin — `/api/superadmin` (all routes: requireSuperAdmin)

| Method | Path | Payload |
|---|---|---|
| GET | `/tenants` | Query: `search?` (≤120), `status?: "ACTIVE"\|"SUSPENDED"`, `page?=1`, `limit?=50` (1–200) |
| GET | `/tenants/:id` | Path: `id` (uuid) |
| GET | `/tenants/:id/users` | Path: `id` (uuid) |
| PATCH | `/tenants/:id/status` | Body: `action: "SUSPEND"\|"ACTIVATE"` (req), `reason` (req, 3–500) |
| POST | `/tenants/:id/impersonate` | Body: `reason` (req, 3–500) → impersonation JWT |
| GET | `/billing` | — |
| GET | `/settings` | — |
| PATCH | `/settings` | Body: `updates: Record<string, boolean\|number\|string>` (req); whitelisted keys only: `maintenance_mode`, `signup_enabled`, `smtp_paused`, `default_otp_expiry_minutes`, `default_otp_length` |
| GET | `/logs` | Query: `action?` (≤60), `tenantId?` (uuid), `limit?=50` (1–200) |

---

## 4. Store — `/api/store` (store.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/setup` | OWNER, CASHIER | `name` (req, 2–120), `type` (req, 1–60), `address?` (≤300, `""`), `city?`, `state?`, `pincode?`, `phone?`, `gst?` (≤25), `currency?` (`"INR"`), `language?` (`"hi"`), `logoUrl?` (≤500), `invoicePrefix?` (`"INV"`) → 201; 409 if already has store |
| GET | `/` | JWT | — |
| PUT | `/` | OWNER, MANAGER | Same fields, **all optional** (`.partial()`) |
| POST | `/staff` | OWNER | `email` (req, email), `name` (req, 2–80), `role?: "CASHIER"\|"MANAGER"\|"STOCK_MANAGER"` (def `"CASHIER"`) → 201 |
| GET | `/staff` | OWNER | — |
| PATCH | `/staff/:id` | OWNER | Body: `isActive?: boolean` (def `false`) |

---

## 5. Users — `/api/users` (user.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | OWNER, MANAGER | — → `{users, invites}` |
| POST | `/invite` | OWNER | `name` (req, 2–80), `email?` / `phone?` (≥1 req; email format / 6–20), `role: "MANAGER"\|"CASHIER"\|"STAFF"` (req) → 201 `{invite, inviteLink}` |
| POST | `/invite/accept` | **none** | `token` (req, ≥20), `name?` (2–80), `password` (req, 6–100) → 201 |
| POST | `/invite/:id/resend` | OWNER | Path only |
| DELETE | `/invite/:id` | OWNER | Path only → 204 |
| PATCH | `/:id` | OWNER | `name?` (2–80), `role?: "OWNER"\|"MANAGER"\|"CASHIER"\|"STAFF"`, `status?: "active"\|"inactive"`, `isActive?: boolean` — last-OWNER guard |
| PATCH | `/:id/status` | OWNER | `status?: "active"\|"inactive"`, `isActive?: boolean` |
| DELETE | `/:id` | OWNER | Path only → 204, last-OWNER guard |

---

## 6. Roles & Settings

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/api/roles/` | JWT | — → `{roles, flags}` (seeds defaults) |
| PATCH | `/api/roles/:role` | OWNER | Path: `role` ∈ MANAGER\|CASHIER\|STAFF (OWNER → 403). Body: `permissions: Record<string, boolean>` (req; flags: `can_manage_invoices`, `can_manage_products`, `can_manage_customers`, `can_manage_udhaari`, `can_manage_suppliers`, `can_manage_expenses`, `can_view_reports`, `can_manage_settings`, `can_manage_users`) |
| PATCH | `/api/settings/language` | OWNER, MANAGER | `language: "en"\|"hi"\|"mr"` (req) |

---

## 7. Customers — `/api/customers` (customer.routes.ts)

Shared **customerSchema**: `name` (req, 1–120), `mobile?` (`""`, ≤15), `address?` (≤300), `city?`, `state?` (≤60), `pincode?` (≤10), `gst?` (≤30), `creditLimit?` (num ≥0, def 0), `openingBalance?` (num ≥0, def 0).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `page`, `limit`, `search?`, `withBalance?` (bool, def false) → rows include `outstanding` |
| POST | `/` | JWT | customerSchema → 201; `openingBalance>0` creates ledger entry |
| GET | `/:id` | JWT | → `{customer, ledger(100), sales(30)}` |
| PUT | `/:id` | JWT | customerSchema **.partial()** |
| DELETE | `/:id` | JWT | — (hard delete, cascades ledger/udhaari) |

---

## 8. Suppliers — `/api/suppliers` (supplier.routes.ts)

Shared **supplierSchema**: `name` (req, 1–120), `phone?` (≤20), `email?` (≤120), `gstin?` (≤30), `address?` (≤300), `category?` (≤60).
Shared **paymentSchema**: `amount` (req, >0), `paymentDate?` (def today), `paymentMode?: "CASH"\|"UPI"\|"CARD"\|"CHEQUE"\|"NEFT"` (def CASH), `poId?`, `note?` (≤300).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/summary` | JWT | — |
| GET | `/` | JWT | Query: `page`, `limit`, `search?`, `filter?: "all"\|"outstanding"\|"settled"` (def all) |
| POST | `/` | OWNER, MANAGER | supplierSchema → 201 |
| GET | `/:id` | JWT | → `{supplier, purchaseOrders(100), payments(100)}` |
| PATCH | `/:id` | OWNER, MANAGER | supplierSchema **.partial()** |
| DELETE | `/:id` | OWNER, MANAGER | Soft delete; 409 `SUPPLIER_HAS_ACTIVE_POS` |
| POST | `/:id/payments` | OWNER, MANAGER, CASHIER | paymentSchema → 201; 400 `PAYMENT_EXCEEDS_OUTSTANDING` |
| GET | `/:id/payments` | JWT | — |
| GET | `/:id/reorder-message` | JWT | — → `{message, phone, waLink, hasPo}` |

---

## 9. Products — `/api/products` (product.routes.ts)

**productSchema (create):** `name` (req, 1–150), `barcode?` (≤64, `""`), `sku?` (≤64), `category?` (≤80), `unit?` (≤16, `"pc"`), `purchasePrice?` (≥0, 0), `sellingPrice?` (≥0, 0), `mrp?` (≥0), `gstPercent?` (0–100, 0), `minStock?` (≥0, 0), `supplier?` (≤150), `imageUrl?` (≤500), `openingStock?` (≥0, 0), `description?` (≤2000, `""`).
**importRowSchema:** `name` (req 1–150) + `category?, sku?, barcode?, unit?, purchasePrice?, sellingPrice?, gstPercent?, minStock?, openingStock?, supplier?, description?` (same constraints).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `search?, category?, archived? (def false), lowStock? (def false), stockStatus?: "all"\|"in"\|"low"\|"out", gst? (0–100), unit?, priceMin?, priceMax?, page, limit` |
| GET | `/summary` | JWT | — |
| GET | `/categories` | JWT | — |
| POST | `/` | OWNER, MANAGER, STOCK_MANAGER, CASHIER | productSchema → 201 |
| POST | `/import/preview` | OWNER/MANAGER/STOCK_MANAGER | `{rows: Row[]}` (req, ≤2000) |
| POST | `/import` | OWNER/MANAGER/STOCK_MANAGER | `{rows: Row[], mode: "skip"\|"update"}` (both req, ≤2000) |
| GET | `/template.csv` · `/template` · `/template.xlsx` | JWT | — (CSV/XLSX/redirect) |
| GET | `/export/pdf` · `/export/xlsx` | JWT | Query: filterSchema (no pagination) |
| POST | `/import/pdf` | OWNER/MANAGER/STOCK_MANAGER | multipart file (`.pdf` required, 5MB) |
| POST | `/import/sheets` | OWNER/MANAGER/STOCK_MANAGER | `{url: string}` (req, valid URL, ≤500) |
| GET | `/:id` | JWT | Path: `id` (uuid) |
| PUT | `/:id` | OWNER, MANAGER, STOCK_MANAGER | productSchema omitting `openingStock`,`imageUrl` **.partial()** (all optional) |
| PATCH | `/:id/archive` | OWNER, MANAGER | `{archived?: boolean}` (def `true`) |
| POST | `/:id/restore` | OWNER/MANAGER/STOCK_MANAGER | — |
| DELETE | `/:id` | **OWNER only** | must be archived first (else 400) |
| POST | `/:id/adjust` | OWNER, MANAGER, STOCK_MANAGER | `qty: number` (req, ≠0), `reason?` (≤300, def `"Manual adjustment"`) |

---

## 10. Inventory — `/api/inventory` (inventory.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/stock/current` | JWT | Query: `lowOnly?` (bool, def false — ⚠ `"false"` coerces to `true`), `search?` |
| GET | `/stock/low` | JWT | — |
| GET | `/movements` | JWT | Query: `page, limit, productId?, type?: "OPENING"\|"SALE"\|"PURCHASE"\|"ADJUSTMENT"\|"REVERSAL", from?, to?` |

---

## 11. Sales — `/api/sales` (sale.routes.ts)

**saleSchema:** `customerId?`, `customer?: {name (req if present, 1–120), mobile? (≤20), address? (≤200), city?, state? (≤80), pincode? (≤10), gst? (≤20)}`, `udhaar?: {dueDate?, reminderDate?}`, `lines: [{productId (req), qty (req >0), unitPrice? (≥0), gstPercent? (0–100), discount? (≥0, def 0)}]` (req, min 1), `paymentMode: "CASH"\|"UPI"\|"CARD"\|"CREDIT"` (req), `discount?` (≥0, 0), `discountType?: "FLAT"\|"PERCENT"` (def FLAT), `paidAmount?` (≥0), `notes?` (≤300).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `page, limit, from?, to?, customerId?, status?: "HELD"\|"CONFIRMED"\|"CANCELED"\|"REVERSED", paymentMode?: "CASH"\|"UPI"\|"CARD"\|"CREDIT", payment?: "PAID"\|"UNPAID"\|"OVERDUE", search?` |
| POST | `/` | OWNER, CASHIER | saleSchema → 201 |
| PUT | `/:id` | OWNER, CASHIER | saleSchema (full) |
| POST | `/:id/pay` | OWNER, CASHIER, MANAGER | — |
| GET | `/:id` · `/:id/invoice` · `/:id/invoice/pdf` | JWT | Path only |
| POST | `/:id/reverse` | OWNER, MANAGER | `reason: string` (req, 2–300) |
| POST | `/hold` | OWNER, CASHIER | `label?` (≤80), `payload: object` (req) → 201 |
| GET | `/held/list` | JWT | — (limit 50) |
| GET | `/held/:id` | JWT | Path only |
| DELETE | `/held/:id` | JWT | Path only |

---

## 12. Purchases — `/api/purchases` (purchase.routes.ts)

**purchaseSchema:** `supplierName` (req, 1–150), `supplierMobile?` (≤15, `""`), `lines: [{productId (req), qty (req >0), unitPrice? (≥0), gstPercent? (0–100)}]` (req, min 1 — no discount field), `discount?` (≥0, 0), `paidAmount?` (≥0), `notes?` (≤300).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `page, limit, from?, to?, supplier?` |
| POST | `/` | OWNER, MANAGER | purchaseSchema → 201 |
| GET | `/:id` | JWT | Path only |
| POST | `/:id/payment` | OWNER, MANAGER, CASHIER | `amount` (req >0), `mode?: "CASH"\|"UPI"\|"CARD"` (def CASH), `note?` (≤200) |

---

## 13. Purchase Orders — `/api/purchase-orders` (purchase-order.routes.ts)

**poSchema:** `supplierId` (req, ≥1), `orderDate?` (`YYYY-MM-DD`, def today), `expectedDate?` (`YYYY-MM-DD`), `status?: "draft"\|"sent"` (def draft), `lines: [{productId (req), quantity (req >0), rate? (≥0, 0), taxRate? (0–100, 0)}]` (req, min 1).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `page, limit, supplierId?, status?: "draft"\|"sent"\|"received"\|"cancelled", from?, to?` |
| POST | `/` | OWNER, MANAGER | poSchema → 201 |
| GET | `/:id` | JWT | Path only |
| PATCH | `/:id` | OWNER, MANAGER | poSchema **.partial()** — draft only, else 409 |
| PATCH | `/:id/status` | OWNER, MANAGER | `status: "sent"\|"received"\|"cancelled"` (req), `expectedDate?` (`YYYY-MM-DD`, applied on →sent); transitions enforced (409 `INVALID_STATUS_TRANSITION`) |
| DELETE | `/:id` | OWNER, MANAGER | draft/cancelled only (else 409) |

---

## 14. Payments — `/api/payments` (payment.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/receive` | JWT | `customerId` (req, ≥1), `amount` (req >0), `mode?: "CASH"\|"UPI"\|"CARD"` (def CASH), `note?` (≤200, `""`) → 201 `{balanceAfter, outstanding}` |
| GET | `/` | JWT | Query: `page, limit, customerId?, from?, to?` |

---

## 15. Udhaari — `/api/udhaari` (udhaari.routes.ts)

**createSchema** (refine: `customerId` or `customer` required): `customerId?` (uuid), `customer?: {name (req if present, 1–150), mobile? (≤20), address? (≤300)}`, `amount` (req >0), `entryDate?` (`YYYY-MM-DD`, def today), `dueDate?`, `reminderDate?` (`YYYY-MM-DD`), `note?` (≤300, `""`), `status?: "PENDING"\|"PAID"\|"PARTIAL"` (def PENDING), `initialPaid?` (≥0, 0).

| Method | Path | Auth | Payload |
|---|---|---|---|
| GET | `/` | JWT | Query: `page, limit, search?, customerId?, status?: "PENDING"\|"PARTIAL"\|"PAID"` |
| GET | `/reminders` | JWT | Query: `scope?: "all"\|"overdue"\|"today"\|"upcoming"` (def all), `search?` (SQL limit 500) |
| GET | `/:customerId` | JWT | Path only |
| POST | `/` | JWT | createSchema → 201 `{entry, customer}` |
| POST | `/:id/pay` | JWT | `amount` (req >0, ≤remaining), `mode?: "CASH"\|"UPI"\|"CARD"` (def CASH), `note?` (≤200) → 201 |

---

## 16. Expenses — registered 3×: `/api/expenses`, `/api/expense-categories`, `/api/recurring-expenses` (expense.routes.ts)

⚠ Every route below exists under **all three prefixes** (14 routes × 3 = 42 URLs).

**createExpenseSchema:** `title` (req, 1–150), `amount` (req >0), `categoryId?: string|null`, `expenseDate?`, `paymentMode?: "CASH"\|"UPI"\|"CARD"\|"BANK"` (def CASH), `note?` (≤500, `""`), `attachmentUrl?: string|null`.
**createRecurringSchema:** `title` (req, 1–150), `amount` (req >0), `categoryId?: string|null`, `frequency?: "MONTHLY"\|"WEEKLY"` (def MONTHLY), `nextDueDate` (req), `paymentMode?: "CASH"\|"UPI"\|"CARD"\|"BANK"` (def CASH).

| Method | Relative path | Auth | Payload | Realistic prefix |
|---|---|---|---|---|
| GET | `/categories` | JWT | — | `/api/expense-categories/categories` or `/api/expenses/categories` |
| POST | `/categories` | OWNER, MANAGER | `name` (req, 1–60) | same |
| DELETE | `/categories/:id` | OWNER, MANAGER | path only | same |
| GET | `/recurring` | JWT | — (⚠ auto-runs due processing) | `/api/recurring-expenses/recurring` |
| POST | `/recurring` | OWNER, MANAGER | createRecurringSchema | same |
| PATCH | `/recurring/:id` | OWNER, MANAGER | createRecurringSchema **.partial()** + `isActive?: boolean` | same |
| DELETE | `/recurring/:id` | OWNER, MANAGER | path only | same |
| POST | `/recurring/process-due` | OWNER, MANAGER | — | same |
| GET | `/summary` | JWT | — | `/api/expenses/summary` |
| GET | `/` | JWT | Query: `page, limit, search?, categoryId?, paymentMode?, from?, to?` | `/api/expenses` |
| POST | `/` | OWNER, MANAGER, CASHIER | createExpenseSchema | `/api/expenses` |
| GET | `/:id` | JWT | path only | `/api/expenses/:id` |
| PATCH | `/:id` | OWNER, MANAGER | createExpenseSchema **.partial()** | `/api/expenses/:id` |
| DELETE | `/:id` | OWNER, MANAGER | path only | `/api/expenses/:id` |

⚠ **Bug found:** the web app POSTs/PATCHes/DELETEs bare `/api/recurring-expenses[/:id]`, which resolves to **regular expense CRUD**, not `/recurring` — Zod silently strips `frequency`/`nextDueDate`/`isActive`, so web recurring create/update/delete silently operates on plain expenses.

---

## 17. Reports — `/api/reports` (report.routes.ts) — all JWT, no role limits

| Method | Path | Query payload |
|---|---|---|
| GET | `/dashboard` | `from?, to?` (def: today 00:00 → 23:59:59.999) |
| GET | `/sales` | `from?, to?` |
| GET | `/purchases` | `from?, to?` |
| GET | `/stock/current` | `lowOnly?` (bool, def false — same `"false"→true` quirk), `search?` |
| GET | `/stock/movements` | `from?, to?, search?, category?` |
| GET | `/gst` | `from?, to?` |
| GET | `/pnl` | `from?, to?` |

---

## 18. Webhooks — `/api/webhooks` (webhook.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/razorpay` | **HMAC** — header `x-razorpay-signature` (SHA256 of raw body) | Razorpay event JSON (`event`, `payload.payment.entity.amount` paise, `entity.notes.reference_id`) → `{ok:true}` |
| POST | `/razorpay/validate` | same HMAC header | body unchecked → `{ok:true}` |

---

## 19. Uploads — `/api/uploads` (upload.routes.ts)

| Method | Path | Auth | Payload |
|---|---|---|---|
| POST | `/image` | JWT + store scope | Query: `entity?` (def `"images"`). `multipart/form-data`: 1 file (any field name), MIME ∈ `jpeg/png/webp/gif`, ≤5MB → 201 `{url}`; 503 if R2 unset |

---

### Summary counts

| Module | Endpoints |
|---|---|
| Auth + recovery + merchant | 11 |
| Health (×2 prefixes) | 4 |
| Superadmin (auth + admin) | 11 |
| Store / Users / Roles / Settings | 17 |
| Customers / Suppliers | 14 |
| Products / Inventory | 22 |
| Sales / Purchases / POs / Payments / Udhaari | 29 |
| Expenses (14 routes × 3 prefixes) | 42 URLs |
| Reports / Webhooks / Uploads | 10 |
| **Total** | **~160 routable URLs (~130 unique route definitions)** |