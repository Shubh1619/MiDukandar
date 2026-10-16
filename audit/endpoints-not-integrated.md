# Backend endpoints not integrated by any client

29 handlers (of 146) are reached by neither `web/` nor `app/` **according to static
call-site matching**. Several are live via a non-obvious caller; each row says which.

## Reached by a non-obvious caller (NOT real gaps)

| handler | why the scanner missed it |
|---|---|
| `GET /api/plans` | Server-side fetch in `web/src/app/pricing/page.tsx:15` (`${baseUrl}/api/plans`). Live. |
| `POST /api/superadmin/plans` | `web/src/components/superadmin/plan-editor.tsx:120` posts to a dynamically-built URL. Live (create). |
| `PATCH /api/superadmin/plans/:id` | Same dynamic URL (edit). Live. |
| `GET /health`, `GET /health/ready` (and `/api` aliases) | `docker-compose.yml` healthcheck and Render probe the plain `/health`. Live infra. |
| `POST /api/webhooks/razorpay`, `…/validate` | Called by Razorpay, not by our UI. Live (external). |
| `POST /api/users/invite/accept` | Now called by the new `web/src/app/invite/accept` page (fixed). |

## Duplicate / dead implementation (safe to delete)

| handler | note |
|---|---|
| `GET /api/expense-categories/recurring` → `/api/expenses/recurring` | Recurring-expense logic duplicated inside `expenseRoutes`; the live copy is `recurringExpenseRoutes` (`/api/recurring-expenses/*`). |
| `POST /api/expense-categories/recurring` → `/api/expenses/recurring` | same |
| `PATCH /api/expense-categories/recurring/:id` → `/api/expenses/recurring/:id` | same |
| `DELETE /api/expense-categories/recurring/:id` → `/api/expenses/recurring/:id` | same |
| `POST /api/expense-categories/recurring/process-due` → `/api/expenses/recurring/process-due` | same |
| `POST /api/recurring-expenses/recurring/process-due` | `process-due` is a cron/ops action, no UI by design — confirm scheduler calls it, otherwise dead. |
| `GET /api/store/staff`, `POST /api/store/staff`, `PATCH /api/store/staff/:id` | Superseded by `/api/users*`. Unused. |
| `GET /api/products/template` | Legacy; web uses `template.csv` / `template.xlsx`. |

## Real gaps — feature exists in backend, no UI

| handler | feature |
|---|---|
| `POST /api/sales/hold` | Park a sale |
| `GET /api/sales/held/list` | List held sales |
| `GET /api/sales/held/:id` | Resume a held sale |
| `DELETE /api/sales/held/:id` | Discard a held sale |
| `GET /api/suppliers/:id/payments` | Supplier payment history |
| `GET /api/inventory/stock/low` | Backed only by the dead mobile method `getLowStockCount` (see `platform-gaps.md`) |
| `GET /api/expense-categories/:id` → `/api/expenses/:id` | Expense detail |
| `DELETE /api/expense-categories/categories/:id` → `/api/expenses/categories/:id` | Delete expense category |
| `POST /api/products/:id/restore` | Un-archive product (web uses `PATCH /:id/archive` toggle instead) |
| `DELETE /api/superadmin/plans/:id` | Delete a plan |
| `GET /api/superadmin/plans/:id` | Fetch one plan (plan list already supplies it) |
