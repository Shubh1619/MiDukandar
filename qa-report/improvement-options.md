# MiDukandar - Improvement Options

Prioritized, low-risk options derived from this QA pass. Nothing here has been implemented; pick the ones you want.

## P0 - correctness & trust (recommend first)

1. **Enforce tenant suspension** (bug E15). Load `stores.status` in the auth guard and reject non-ACTIVE stores with 403. Impact: high, effort: small.
2. **Enforce role permissions server-side** (bugs B09, B24-flags). Either wire `checkPermission()` into the routes or tighten `requireRole` on product/expense routes. Impact: high, effort: medium.
3. **Fix stock-movement report filter** (bug G09). Add the missing `p` alias. Impact: medium, effort: tiny.
4. **Validate dates & UUID path params; stop leaking PG codes** (bugs D10, G10, G09c). Add zod schemas and a generic internal-error body. Impact: medium, effort: small.

## P1 - data quality & API hygiene

5. **Robust duplicate detection** (bug C03). Always normalize+compare name; keep sku/barcode exact matches. Impact: medium, effort: small.
6. **Consistent recurring-expense surface** (bug C32). Align list path or remove the unused router. Impact: low-medium, effort: small.
7. **Account-enumeration-safe OTP** (bug A05). Return a uniform 200 for unknown emails. Impact: medium, effort: small.
8. **Gate `devOtp` behind an explicit env flag** (bug A06). Impact: medium (if any non-prod build is reachable), effort: tiny.

## P2 - hardening & polish

9. **Security headers** (bugs F05, F06). Add `@fastify/helmet` (backend) and HSTS at the edge (web). Impact: low, effort: tiny.
10. **robots.txt / sitemap** (bug F09b). SEO hygiene. Impact: low, effort: tiny.
11. **Better error copy** (see ux-feedback). Impact: low, effort: small.

## Notes
- Out of scope for the local pass: Render 508 routing and Brevo egress-IP whitelisting (see repo notes); these need environment changes, not code.
- If you want, I can implement P0 as a single focused change set and re-run the automated suite to prove the failures flip to PASS.
