# CUSTOMERS_UDHAARI

Customer + udhaari ledger fully integrated on both. `GET /api/customers/:id` web-only (mobile uses list).

Handlers: **10** | web: 10 | mobile: 8 | neither: 0

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/customers` | authenticate+requireStore | yes | yes | customer.routes.ts |
| POST | `/api/customers` | authenticate+requireStore | yes | yes | customer.routes.ts |
| DELETE | `/api/customers/:id` | authenticate+requireStore | yes | yes | customer.routes.ts |
| GET | `/api/customers/:id` | authenticate+requireStore | yes | no | customer.routes.ts |
| PUT | `/api/customers/:id` | authenticate+requireStore | yes | yes | customer.routes.ts |
| GET | `/api/udhaari` | authenticate+requireStore | yes | yes | udhaari.routes.ts |
| POST | `/api/udhaari` | authenticate+requireStore | yes | yes | udhaari.routes.ts |
| GET | `/api/udhaari/:customerId` | authenticate+requireStore | yes | yes | udhaari.routes.ts |
| POST | `/api/udhaari/:id/pay` | authenticate+requireStore | yes | no | udhaari.routes.ts |
| GET | `/api/udhaari/reminders` | authenticate+requireStore | yes | yes | udhaari.routes.ts |
