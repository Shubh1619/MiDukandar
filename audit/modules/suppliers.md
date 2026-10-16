# SUPPLIERS

Suppliers, payments, reorder-message wired. `GET /api/suppliers/:id/payments` unused (no payment-history UI on either platform).

Handlers: **10** | web: 8 | mobile: 6 | neither: 1

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/suppliers` | authenticate+requireStore | yes | yes | supplier.routes.ts |
| POST | `/api/suppliers` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | supplier.routes.ts |
| DELETE | `/api/suppliers/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | supplier.routes.ts |
| GET | `/api/suppliers/:id` | authenticate+requireStore | yes | no | supplier.routes.ts |
| PATCH | `/api/suppliers/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | supplier.routes.ts |
| POST | `/api/suppliers/:id/invoice` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | yes | supplier.routes.ts |
| GET | `/api/suppliers/:id/payments` | authenticate+requireStore | no | no | supplier.routes.ts |
| POST | `/api/suppliers/:id/payments` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.CASHIER)+requireStore | yes | no | supplier.routes.ts |
| GET | `/api/suppliers/:id/reorder-message` | authenticate+requireStore | yes | no | supplier.routes.ts |
| GET | `/api/suppliers/summary` | authenticate+requireStore | yes | yes | supplier.routes.ts |
