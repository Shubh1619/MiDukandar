# Mismatches & scanner corrections

Discrepancies between the raw extraction and manual review. Each was verified by hand.

## Method / path

- **None remaining.** Earlier passes reported web calls hitting a path with the wrong
  method (e.g. `/api/auth/recovery/*`). That was a scanner bug: `apiFetch`/`saFetch`
  default to `POST` when a body is present, and the recovery calls pass `body:` with
  `noAuth: true`. They ARE `POST`, matching the backend. Fixed in `scan-web.mjs`.
- Wildcard-only match `GET /api/products/export/${kind}` → resolves to the real
  `/export/pdf` and `/export/xlsx`. Valid.

## Auth attribute errors (scanner over/under-reports)

- `POST /api/users/invite/accept` is listed as `authenticate` but is in fact
  **PUBLIC**. The handler (`user.routes.ts`) has no `preHandler`; the scanner attached
  the previous route's guard. This is by design (the invitee only holds a token).
- Superadmin plan routes are guarded by a **plugin-level hook**
  (`app.addHook("preHandler", requireSuperAdmin)` in `superadmin.routes.ts:35`), not a
  per-route `preHandler`. The map labels them accordingly; there is no per-route guard
  to find.

## Validation attribute

- No route uses Fastify's `schema:` option (0/162). In-handler validation is zod via
  `parse(schema, data)` (`backend/src/lib/validate.ts`). Rows marked `NONE-DETECTED`
  mostly mean "no zod call in this handler" — common and acceptable for `GET /:id`.

## Dual-mounted handlers (URL counts ≠ handler counts)

- `expenseRoutes` is mounted at **both** `/api/expenses` and `/api/expense-categories`.
- `healthRoutes` at **both** `/health` and `/api/health`.
- `productImportRoutes` / `productExportRoutes` are nested inside `product.routes.ts`
  under the `/api/products` prefix.
- Result: 162 URL rows collapse to **146 distinct handlers**. The module tables are
  handler-level.

## Integration false-positives reconciled by hand

| item | scanner said | reality |
|---|---|---|
| `GET /api/plans` | unused | used server-side by `web/src/app/pricing/page.tsx` |
| `POST/PATCH /api/superadmin/plans` | unused | used by `plan-editor.tsx` via dynamic URL |
| `GET /api/superadmin/auth/me`, `POST …/logout` | (bare `fetch`) | used in `web/src/lib/superadmin-store.ts` |
| `getDashboardSummary` (mobile) | unused | called at `app/lib/main.dart:137` (naive `apiService.` regex missed `_apiService.`) |
| invoice search/filter | dead handlers | UI wires inline lambdas (`invoice_screen.dart:542-561`) → works |

## Config / port note (corrected)

- The local dev API port is **4000**: `docker-compose.yml` (`PORT: 4000`, `4000:4000`,
  `BACKEND_URL: http://backend:4000`) and root `.env.example` (`PORT=4000`). So the
  `http://localhost:4000` fallbacks in `web/src/proxy.ts:4` and
  `web/src/app/pricing/page.tsx:15` are **correct**, not stale. (The earlier report's
  "stale default port" item was wrong.)
- Deployment (Render) runs the API on `API_PORT=5000` via `docker-entrypoint.sh`, so
  there `BACKEND_URL` must be `http://127.0.0.1:5000`.
