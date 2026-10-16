# MiDukandar QA Report - Bugs & Warnings

Ordered by severity. Each item lists expected vs actual plus a source-level root cause and suggested fix.

## E15 - Suspended tenant still has API access (suspension not enforced)

- **Status:** FAIL  **Severity:** high
- **Expected:** Suspended tenant requests rejected (401/403)
- **Actual:** suspended tenant GET /auth/me = 200
- **Notes:** authenticate() never checks stores.status, so a SUSPENDED tenant keeps full API access.
- **Impact:** A suspended tenant (billing/non-payment enforcement) keeps full API access; suspension is cosmetic.
- **Root cause:** `authenticate()` in backend/src/middlewares/auth.ts validates the JWT but never loads/checks `stores.status`, so `SUSPENDED` stores continue to read/write.
- **Suggested fix:** In the auth pre-handler (or a store-status guard) look up the store and reject with 403 `STORE_SUSPENDED` when status != 'ACTIVE' (allow superadmin impersonation tokens through).

## A06 - OTP request existing email does not return OTP in body

- **Status:** FAIL  **Severity:** medium
- **Expected:** no OTP value in response body
- **Actual:** status=200 leaksOtp=true
- **Evidence:** `{"ok":true,"expiresInSeconds":60,"emailSent":true,"devOtp":"000000"}`
- **Notes:** OTP value returned in response body
- **Impact:** In non-production builds the OTP is returned in the response body (`devOtp`), defeating OTP secrecy if a dev/staging build is exposed.
- **Root cause:** `sendMail`/OTP route returns the code when `config.mailMode === 'log'` (dev).
- **Suggested fix:** Keep devOtp behind an explicit `QA_OTP_ECHO` flag; never echo in any deployment that could be reached over a network.

## B09 - Cashier product-create matches permission matrix (can_manage_products=false)

- **Status:** FAIL  **Severity:** medium
- **Expected:** 403 per DEFAULT_PERMISSIONS.CASHIER.can_manage_products=false
- **Actual:** 201
- **Notes:** POST /api/products preHandler allows CASHIER; role gate contradicts the advertised permission matrix (which is itself unenforced).
- **Impact:** A CASHIER can create products, contradicting the advertised role matrix (DEFAULT_PERMISSIONS.CASHIER.can_manage_products=false).
- **Root cause:** POST/PUT/DELETE product routes gate on `authenticate` + a coarse role check that includes CASHIER; the per-role permission flags (checkPermission) are never consulted.
- **Suggested fix:** Centralize authorization: enforce DEFAULT_PERMISSIONS flags server-side for products/sales/expenses/etc., or tighten the product route's requireRole to OWNER/MANAGER/STOCK_MANAGER.

## C03 - Duplicate product NAME blocked even when existing product has a SKU

- **Status:** FAIL  **Severity:** medium
- **Expected:** 409 PRODUCT_EXISTS
- **Actual:** 201
- **Notes:** findDuplicate() only compares name when the EXISTING row has NULL sku AND barcode; the cloned name was accepted because C01 set a SKU.
- **Impact:** Duplicate products with the same name are created silently whenever the incoming product has a SKU/barcode, or the existing one does. Inflates catalogue, splits stock.
- **Root cause:** findDuplicate() only evaluates the name clause when the INCOMING input has no sku AND no barcode, and the clause itself requires the EXISTING row to have `sku IS NULL AND barcode IS NULL`.
- **Suggested fix:** Always compare a normalized name within the store regardless of sku/barcode presence, while still allowing a distinct sku/barcode to be a separate explicit signal.

## D10 - GST invalid date -> 400

- **Status:** FAIL  **Severity:** medium
- **Expected:** 400
- **Actual:** 500 {"error":"Internal server error","code":
- **Notes:** Invalid date reaches Postgres and throws 500 (code 22007) and the PG code is echoed to the client.
- **Impact:** Invalid `from`/`to` dates crash reports (500) instead of a 400 validation error; the Postgres error code is echoed to the caller.
- **Root cause:** `dateRangeSchema` accepts any string; the value is passed to Postgres, which raises 22007 (invalid_datetime_format), and the global error handler serializes `err.code`.
- **Suggested fix:** Validate ISO dates in dateRangeSchema (z.coerce.date or regex) and stop returning raw DB error codes in responses.

## F01 - Web home returns 200

- **Status:** FAIL  **Severity:** medium
- **Expected:** 200
- **Actual:** 307

## F04 - Unauthenticated /dashboard redirects to login

- **Status:** FAIL  **Severity:** medium
- **Expected:** 3xx -> /login
- **Actual:** 200 loc=

## F05 - Web sets security headers

- **Status:** FAIL  **Severity:** medium
- **Expected:** HSTS, CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy
- **Actual:** missing=hsts
- **Evidence:** `{"hsts":"","csp":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'","xfo":"DENY","nosniff":"nosniff","referrer":"strict-origin-when-cross-origin","permissions":"camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()"}`
- **Notes:** Missing browser hardening headers on the web app.
- **Impact:** Web responses omit Strict-Transport-Security.
- **Root cause:** No HSTS header configured in next.config / proxy.
- **Suggested fix:** Add HSTS (and re-check CSP) at the edge for HTTPS deployments.

## G09 - Report stock/movements search/category filter does not 500

- **Status:** FAIL  **Severity:** medium
- **Expected:** 200 for both filters
- **Actual:** search=500 category=500
- **Notes:** Query aliases products as 'p' but FROM has no alias, so any search/category filter errors with 'missing FROM-clause entry for table p'.
- **Impact:** /api/reports/stock/movements returns 500 whenever `search` or `category` is supplied - the filter is unusable.
- **Root cause:** The report query filters on `p.name`/`p.category` but selects `FROM products` without the `p` alias ('missing FROM-clause entry for table "p"'). Values are still parameterized (not injectable), so this is a functional bug, not SQLi.
- **Suggested fix:** Alias the table (FROM products p) in getStockMovementReport, matching the other report queries.

## G10 - Non-UUID path id rejected with 400

- **Status:** FAIL  **Severity:** medium
- **Expected:** 400
- **Actual:** 500
- **Impact:** GET /api/products/:id with a non-UUID id returns 500 (PG 22P02) instead of 400.
- **Root cause:** `:id` params are not schema-validated as UUID on the product routes (other routes do use zod UUID params).
- **Suggested fix:** Validate path params with `z.object({ id: z.string().uuid() })` consistently.

## F06 - API responses set X-Content-Type-Options nosniff

- **Status:** FAIL  **Severity:** low
- **Expected:** nosniff
- **Actual:** absent
- **Impact:** API responses omit X-Content-Type-Options: nosniff.
- **Root cause:** No security headers plugin on Fastify.
- **Suggested fix:** Add @fastify/helmet on the backend.

## F09b - robots.txt present

- **Status:** FAIL  **Severity:** low
- **Expected:** 200
- **Actual:** 404
- **Impact:** No /robots.txt on the web app.
- **Root cause:** Missing static file.
- **Suggested fix:** Add robots.txt (and sitemap) for SEO hygiene.

## G09c - Error responses do not leak Postgres error codes

- **Status:** FAIL  **Severity:** low
- **Expected:** generic error, no PG code
- **Actual:** leaked {"error":"Internal server error","code":"22P02"}
- **Impact:** Internal Postgres error codes (22P02/22007/42P01) are returned in JSON error bodies.
- **Root cause:** The global error handler includes `err.code` for unhandled DB errors.
- **Suggested fix:** Log the code server-side; return a generic `{ error, code: 'INTERNAL' }` to clients.

## A05 - OTP request unknown email (LOGIN) leaks account existence (404 vs 200)

- **Status:** WARN  **Severity:** n/a
- **Expected:** Ideally identical response for existent/non-existent emails
- **Actual:** unknown=404 (ACCOUNT_NOT_FOUND), known=200
- **Notes:** Account enumeration: registered emails return 200, unknown return 404 with code ACCOUNT_NOT_FOUND.
- **Impact:** Account enumeration: POST /auth/otp/request returns 404 ACCOUNT_NOT_FOUND for unknown emails and 200 for known ones.
- **Root cause:** The route resolves the user before deciding the response.
- **Suggested fix:** Always return the same 200 'OTP sent' generic response for both cases (send a 'no account' email instead).

## C32 - List recurring expenses: GET /api/recurring-expenses is inconsistent (404); real list is /recurring

- **Status:** WARN  **Severity:** n/a
- **Expected:** GET /api/recurring-expenses returns 200 (natural REST path)
- **Actual:** GET /api/recurring-expenses=404, GET /api/recurring-expenses/recurring=200
- **Notes:** The recurring-expense router exposes list at '/recurring' while create/update/delete use the bare prefix, so the natural GET /api/recurring-expenses 404s. No web/mobile client calls these endpoints.
- **Impact:** Credit-recurring-expense API is internally inconsistent: list lives at `/recurring-expenses/recurring` while create/update/delete use `/recurring-expenses`; `GET /recurring-expenses` 404s. No client uses it.
- **Root cause:** recurringExpenseRoutes mounts the list handler with an extra '/recurring' segment.
- **Suggested fix:** Align the list path with the rest of the router (or remove the route entirely if unused).

