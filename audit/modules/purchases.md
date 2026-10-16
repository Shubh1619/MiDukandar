# PURCHASES

Purchase orders + purchase entry are web-only (POS/admin flow). Mobile has NO purchase-order UI, so 7 PO endpoints are web-only by design.

Handlers: **10** | web: 10 | mobile: 3 | neither: 0

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/purchase-orders` | authenticate+requireStore | yes | no | purchase-order.routes.ts |
| POST | `/api/purchase-orders` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | purchase-order.routes.ts |
| DELETE | `/api/purchase-orders/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | purchase-order.routes.ts |
| GET | `/api/purchase-orders/:id` | authenticate+requireStore | yes | no | purchase-order.routes.ts |
| PATCH | `/api/purchase-orders/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | purchase-order.routes.ts |
| PATCH | `/api/purchase-orders/:id/status` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | purchase-order.routes.ts |
| GET | `/api/purchases` | authenticate+requireStore | yes | yes | purchase.routes.ts |
| POST | `/api/purchases` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | purchase.routes.ts |
| GET | `/api/purchases/:id` | authenticate+requireStore | yes | no | purchase.routes.ts |
| POST | `/api/purchases/:id/payment` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.CASHIER)+requireStore | yes | yes | purchase.routes.ts |
