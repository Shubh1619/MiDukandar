# SALES_INVOICES

Sale create/list/detail/invoice/pdf used. Held-sale (park/resume cart) endpoints exist on backend but have NO UI on web or mobile -> feature not exposed. `GET /api/sales/:id` only used by web.

Handlers: **12** | web: 8 | mobile: 5 | neither: 4

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/sales` | authenticate+requireStore | yes | yes | sale.routes.ts |
| POST | `/api/sales` | authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER)+requireStore | yes | yes | sale.routes.ts |
| GET | `/api/sales/:id` | authenticate+requireStore | yes | no | sale.routes.ts |
| PUT | `/api/sales/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER)+requireStore | yes | yes | sale.routes.ts |
| GET | `/api/sales/:id/invoice` | authenticate+requireStore | yes | no | sale.routes.ts |
| GET | `/api/sales/:id/invoice/pdf` | authenticate+requireStore | yes | no | sale.routes.ts |
| POST | `/api/sales/:id/pay` | authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER,ROLES.MANAGER)+requireStore | yes | yes | sale.routes.ts |
| POST | `/api/sales/:id/reverse` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | sale.routes.ts |
| DELETE | `/api/sales/held/:id` | authenticate+requireStore | no | no | sale.routes.ts |
| GET | `/api/sales/held/:id` | authenticate+requireStore | no | no | sale.routes.ts |
| GET | `/api/sales/held/list` | authenticate+requireStore | no | no | sale.routes.ts |
| POST | `/api/sales/hold` | authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER)+requireStore | no | no | sale.routes.ts |
