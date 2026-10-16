# EXPENSES

Expense CRUD/categories/summary wired on web; mobile has expense list + categories. DUPLICATION: recurring-expense handlers are implemented twice (inside `expenseRoutes` and again in `recurringExpenseRoutes`); the `expenseRoutes` copies reachable only via `/api/expense-categories/recurring*` and `/api/expenses/recurring*` are dead. Category edit/delete and expense-by-id are not exposed in any UI.

Handlers: **19** | web: 11 | mobile: 6 | neither: 8

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/expense-categories` | authenticate+requireStore | yes | yes | expense.routes.ts |
| POST | `/api/expense-categories` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER,ROLES.CASHIER)+requireStore | yes | yes | expense.routes.ts |
| DELETE | `/api/expense-categories/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | expense.routes.ts |
| GET | `/api/expense-categories/:id` | authenticate+requireStore | no | no | expense.routes.ts |
| PATCH | `/api/expense-categories/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | expense.routes.ts |
| GET | `/api/expense-categories/categories` | authenticate+requireStore | yes | yes | expense.routes.ts |
| POST | `/api/expense-categories/categories` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | expense.routes.ts |
| DELETE | `/api/expense-categories/categories/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
| GET | `/api/expense-categories/recurring` | authenticate+requireStore | no | no | expense.routes.ts |
| POST | `/api/expense-categories/recurring` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
| DELETE | `/api/expense-categories/recurring/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
| PATCH | `/api/expense-categories/recurring/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
| POST | `/api/expense-categories/recurring/process-due` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
| GET | `/api/expense-categories/summary` | authenticate+requireStore | yes | yes | expense.routes.ts |
| POST | `/api/recurring-expenses` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | expense.routes.ts |
| DELETE | `/api/recurring-expenses/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | expense.routes.ts |
| PATCH | `/api/recurring-expenses/:id` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | no | expense.routes.ts |
| GET | `/api/recurring-expenses/recurring` | authenticate+requireStore | yes | no | expense.routes.ts |
| POST | `/api/recurring-expenses/recurring/process-due` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | no | no | expense.routes.ts |
