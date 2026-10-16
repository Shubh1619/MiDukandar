# UI without a backend endpoint

## Web calls that hit no backend route

| call | site | verdict |
|---|---|---|
| `POST <var:plan>` (dynamic URL) | `web/src/components/superadmin/plan-editor.tsx:120` | **False positive.** The URL is `POST /api/superadmin/plans` when creating and `PATCH /api/superadmin/plans/:id` when editing. Both routes exist. |

No other web call site targets a missing route.

## Web calls that only wildcard-match (dynamic segment)

| call | site | matches |
|---|---|---|
| `GET /api/products/export/${kind}?…` | `web/src/app/(main)/products/page.tsx:498` | `GET /api/products/export/pdf`, `GET /api/products/export/xlsx` (valid) |

## UI deep-links that land on a missing page

| link | produced by | landing page |
|---|---|---|
| `/invite/accept?token=…` | `backend/src/routes/user.routes.ts` (returned as `inviteLink`) | **FIXED** — `web/src/app/invite/accept/page.tsx` added; web users/settings and the Flutter users screen now surface the link with a copy action. |

## Mobile calls that hit no backend route

None. All 65 mobile call sites resolve to a registered route.
