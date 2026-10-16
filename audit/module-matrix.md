# Per-module endpoint usage matrix (handler-level)

| plan module | handlers | used by web | used by mobile | used by neither |
|---|---|---|---|---|
| (un-gated: auth/store/superadmin/plans/webhooks/uploads/health) | 41 | 31 | 10 | 9 |
| BILLING | 2 | 2 | 2 | 0 |
| CUSTOMERS_UDHAARI | 10 | 10 | 8 | 0 |
| DASHBOARD | 1 | 1 | 1 | 0 |
| EXPENSES | 19 | 11 | 6 | 8 |
| GST_REPORTS | 6 | 6 | 2 | 0 |
| INVENTORY | 3 | 2 | 2 | 1 |
| PRODUCTS | 19 | 17 | 8 | 2 |
| PURCHASES | 10 | 10 | 3 | 0 |
| SALES_INVOICES | 12 | 8 | 5 | 4 |
| SUPPLIERS | 10 | 8 | 6 | 1 |
| USERS_ROLES | 13 | 9 | 4 | 4 |

## Unused handlers by module
### (un-gated: auth/store/superadmin/plans/webhooks/uploads/health)
- `GET /api/health`
- `GET /api/health/ready`
- `GET /api/plans`
- `POST /api/superadmin/plans`
- `DELETE /api/superadmin/plans/:id`
- `GET /api/superadmin/plans/:id`
- `PATCH /api/superadmin/plans/:id`
- `POST /api/webhooks/razorpay`
- `POST /api/webhooks/razorpay/validate`
### BILLING
- (all integrated)
### CUSTOMERS_UDHAARI
- (all integrated)
### DASHBOARD
- (all integrated)
### EXPENSES
- `GET /api/expense-categories/:id`
- `DELETE /api/expense-categories/categories/:id`
- `GET /api/expense-categories/recurring`
- `POST /api/expense-categories/recurring`
- `DELETE /api/expense-categories/recurring/:id`
- `PATCH /api/expense-categories/recurring/:id`
- `POST /api/expense-categories/recurring/process-due`
- `POST /api/recurring-expenses/recurring/process-due`
### GST_REPORTS
- (all integrated)
### INVENTORY
- `GET /api/inventory/stock/low`
### PRODUCTS
- `POST /api/products/:id/restore`
- `GET /api/products/template`
### PURCHASES
- (all integrated)
### SALES_INVOICES
- `DELETE /api/sales/held/:id`
- `GET /api/sales/held/:id`
- `GET /api/sales/held/list`
- `POST /api/sales/hold`
### SUPPLIERS
- `GET /api/suppliers/:id/payments`
### USERS_ROLES
- `GET /api/store/staff`
- `POST /api/store/staff`
- `PATCH /api/store/staff/:id`
- `POST /api/users/invite/accept`
