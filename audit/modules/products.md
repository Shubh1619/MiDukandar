# PRODUCTS

Core catalog fully wired on web (CRUD, import, export, template, images) and mobile (CRUD, stock). Unused: `POST /:id/restore` (web uses `PATCH /:id/archive` toggle instead) and legacy `GET /api/products/template` (web uses `template.csv`/`template.xlsx`).

Handlers: **19** | web: 17 | mobile: 8 | neither: 2

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/products` | authenticate+requireStore | yes | yes | product.routes.ts |
| POST | `/api/products` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.STOCK_MANAGER,ROLES.CASHIER)+requireStore | yes | yes | product.routes.ts |
| DELETE | `/api/products/:id` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | no | product.routes.ts |
| GET | `/api/products/:id` | authenticate+requireStore | yes | yes | product.routes.ts |
| PUT | `/api/products/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.STOCK_MANAGER)+requireStore | yes | yes | product.routes.ts |
| POST | `/api/products/:id/adjust` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.STOCK_MANAGER)+requireStore | yes | yes | product.routes.ts |
| PATCH | `/api/products/:id/archive` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | product.routes.ts |
| POST | `/api/products/:id/restore` | authenticate+requireStore | no | no | product.routes.ts |
| GET | `/api/products/categories` | authenticate+requireStore | yes | yes | product.routes.ts |
| GET | `/api/products/export/pdf` | authenticate | yes | no | product-export.routes.ts |
| GET | `/api/products/export/xlsx` | authenticate | yes | no | product-export.routes.ts |
| POST | `/api/products/import` | authenticate+requireStore | yes | no | product-import.routes.ts |
| POST | `/api/products/import/pdf` | authenticate | yes | no | product-import.routes.ts |
| POST | `/api/products/import/preview` | authenticate+requireStore | yes | no | product-import.routes.ts |
| POST | `/api/products/import/sheets` | authenticate | yes | no | product-import.routes.ts |
| GET | `/api/products/summary` | authenticate+requireStore | yes | yes | product.routes.ts |
| GET | `/api/products/template` | authenticate | no | no | product-export.routes.ts |
| GET | `/api/products/template.csv` | authenticate | yes | no | product-export.routes.ts |
| GET | `/api/products/template.xlsx` | authenticate+requireStore | yes | no | product-export.routes.ts |
