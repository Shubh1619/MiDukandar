# INVENTORY

Stock list and movements used by both clients. `GET /api/inventory/stock/low` is backed only by the dead mobile method `getLowStockCount` -> effectively unused.

Handlers: **3** | web: 2 | mobile: 2 | neither: 1

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/inventory/movements` | authenticate+requireStore | yes | yes | inventory.routes.ts |
| GET | `/api/inventory/stock/current` | authenticate+requireStore | yes | yes | inventory.routes.ts |
| GET | `/api/inventory/stock/low` | authenticate+requireStore | no | no | inventory.routes.ts |
