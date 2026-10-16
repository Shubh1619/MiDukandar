# MiDukandar QA Report - Security & Permissions

## Authentication (Section A)
- PASS  A01: Health endpoint returns ok
- PASS  A02: login-kind: tenant email -> tenant
- PASS  A03: login-kind: superadmin email -> superadmin
- PASS  A04: login-kind: unknown email -> tenant (no enumeration)
- WARN  A05: OTP request unknown email (LOGIN) leaks account existence (404 vs 200) - unknown=404 (ACCOUNT_NOT_FOUND), known=200
- FAIL  A06: OTP request existing email does not return OTP in body - status=200 leaksOtp=true
- PASS  A07: OTP verify wrong code -> 4xx
- PASS  A08: OTP verify short/malformed code -> 400
- PASS  A09: OTP verify success -> accessToken + HttpOnly refresh cookie
- PASS  A10: GET /auth/me -> user, store, permissions, plan
- PASS  A11: /auth/me without token -> 401
- PASS  A12: /auth/me with tampered signature -> 401
- PASS  A13: Authorization header without Bearer scheme -> 401
- PASS  A14: Superadmin cookie cannot access tenant API
- PASS  A15: Tenant token cannot access superadmin API
- PASS  A16: Refresh (cookie) rotates token + issues new cookie
- PASS  A17: Refresh with no token -> 401
- PASS  A18: Logout revokes refresh token (further refresh -> 401)
- PASS  A19: Register duplicate email -> 409
- PASS  A20: Register invalid email -> 400
- PASS  A21: Superadmin login wrong password -> 401
- PASS  A22: No tenant password-login route exposed (OTP only)

## Authorization, tenant isolation, plan gating (Section B)

### Role checks
- B01 PASS - Owner can list users
- B02 PASS - Manager can list users
- B03 PASS - Cashier blocked from listing users
- B04 PASS - Staff blocked from listing users
- B05 PASS - Manager blocked from inviting users (owner-only)
- B06 PASS - Cashier blocked from editing role permissions
- B07 PASS - Manager can read role matrix
- B08 PASS - Staff blocked from creating products
- B09 FAIL - Cashier product-create matches permission matrix (can_manage_products=false)
- B11 PASS - Cashier can reach create-sale handler (bad body -> 400, not 403)
- B12 PASS - Staff blocked from creating sales

### Cross-tenant isolation
- B13 PASS - Store2 sees only its own products (store isolation) (200 total=0)
- B14 PASS - Store2 cannot read Store1 product by id (404, no leak) (404)
- B15 PASS - Store2 cannot read Store1 sale by id (404) (404)
- B16 PASS - Store2 cannot read Store1 customer by id (404) (404)
- B17 PASS - Store2 cannot mutate Store1 product (404) (404)
- G01 PASS - Cross-tenant product read -> 404 (404)
- G02 PASS - Cross-tenant product update -> 404/403 (404)
- G03 PASS - Cross-tenant product delete -> 404/403 (404)
- G04 PASS - Cross-tenant customer read -> 404 (404)
- G05 PASS - Cross-tenant sale read -> 404 (404)
- G06 PASS - Cross-tenant invoice PDF -> 404/403 (404)
- G07 PASS - Cross-tenant held bill read -> 404 (404)

### Plan / module gating
- B18 PASS - Free plan: SUPPLIERS module blocked
- B19 PASS - Free plan: PURCHASES module blocked
- B20 PASS - Free plan: EXPENSES module blocked
- B21 PASS - Free plan: USERS_ROLES module blocked
- B22 PASS - Free plan: GST_REPORTS (reports/pnl) blocked
- B23 PASS - Free plan: GST_REPORTS (reports/sales) blocked
- B23b PASS - Free plan: DASHBOARD still allowed
- B23b-check PASS - Pro plan: reports/pnl accessible
- B24 PASS - Pro plan: suppliers accessible

**Finding:** the per-role permission flags exposed by `/api/roles` are not enforced server-side (`checkPermission()` is dead code). `POST /api/products` accepts CASHIER (B09). Treat the matrix as UI-only until wired.

## Security probes (Section G)

### Injection & input validation
- G08 PASS - SQLi in product search does not 500 (200)
- G09 FAIL - Report stock/movements search/category filter does not 500 (search=500 category=500)
- G09b PASS - SQLi payloads in report filters are parameterized (no injection) (500 (missing FROM-clause, not injected rows))
- G09c FAIL - Error responses do not leak Postgres error codes (leaked {"error":"Internal server error","code":"22P02"})
- G10 FAIL - Non-UUID path id rejected with 400 (500)
- G11 PASS - Non-UUID tenant id rejected with 400 (401)

- All JSON/SQL values in product/report queries are **parameterized**; the report-filter 500 (G09) is an alias bug, not an injection.

### Token integrity & mass assignment
- G12 PASS - Tampered JWT signature -> 401 (401)
- G12b PASS - JWT payload tamper (storeId swap) -> 401 (401)
- G12c PASS - Product create ignores store_id/is_archived/stock overrides (201 storeIdOk=true archived=false)

### Privilege & data exposure
- G13 PASS - Cashier cannot list/manage users (403)
- G13b PASS - Cashier cannot invite users (403)
- G13c PASS - Owner PATCH user role SUPERADMIN rejected (400)
- G13d PASS - Owner cannot delete self (last owner guard) (400)
- G16 PASS - auth/me does not leak password_hash (clean)
- G17 PASS - Product list has no foreign-store data (0 rows, foreign=0)
- G18 PASS - Error responses do not leak stack traces (clean)
- G19 PASS - Huge limit is clamped/rejected (400 returned=0)
- G20 PASS - Negative page rejected (400)

## Platform / superadmin (Section E)
- E00 PASS - Superadmin login (fresh token) succeeds (200)
- E01 PASS - Superadmin login sets HttpOnly mz_sa cookie (200 cookie=HttpOnly)
- E02 PASS - Superadmin /me authenticated via cookie (200 {"superadmin":{"id":"aeb563cb-4fd9-4e98-959b-d21b1219c576","email":"superadmin@m)
- E03 PASS - Unauthenticated superadmin API -> 401 (401)
- E04 PASS - Tenant access to superadmin API blocked (401)
- E05 PASS - Tenants list returns rows + total (200 total=2)
- E06 PASS - Tenant detail returns store + stats (200 owner=owner@midukandar.demo)
- E07 PASS - Tenant users list (200 users=4)
- E08 PASS - Billing summary returns plans + tenants (200 tenants=2)
- E09 PASS - Settings GET returns object (200)
- E10 PASS - Settings PATCH applies whitelisted key (200 applied={"maintenance_mode":false})
- E11 PASS - Settings PATCH ignores non-whitelisted key (200 applied={})
- E12 PASS - Logs endpoint returns audit arrays (200 saLogs=50)
- E13 PASS - Impersonate returns a tenant token (imp=200 meAsImpersonated=200 role=OWNER)
- E14 PASS - Suspend then reactivate a tenant (store2) (suspend=200/SUSPENDED activate=200/ACTIVE)
- E15 FAIL - Suspended tenant still has API access (suspension not enforced) (suspended tenant GET /auth/me = 200)
- E16 PASS - Suspend unknown tenant -> 404 (404)
- E16b PASS - Double suspend -> 409 (409)
- E17 PASS - Create plan (draft) -> 201 (201 id=55b3ca1e-6754-48f5-bbed-eb473f7144e2 )
- E18 PASS - Update plan -> 200 (200)
- E19 PASS - Duplicate plan -> 201 (201)
- E20 PASS - Archive/delete plan -> 200 (200)
- E21 PASS - Assign nonexistent plan to tenant -> 404 (404)

**Finding (high):** suspending a tenant (E15) does not block API access - suspension is not enforced in `authenticate()`.

## Platform hardening (Section F)
- F05 FAIL - Web sets security headers (missing=hsts)
- F06 FAIL - API responses set X-Content-Type-Options nosniff (absent)
- F07 PASS - CORS: API does not reflect arbitrary Origin with credentials (ACAO=none ACAC=none)
- F08 PASS - CORS preflight from untrusted origin not permissive (403 ACAO=none)
- F09 PASS - API docs/swagger not publicly exposed (none)
