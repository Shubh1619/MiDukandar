## Web calls with NO matching backend endpoint (method + path)

- `POST <var:plan>` — web/src/components/superadmin/plan-editor.tsx:120 — NO BACKEND ROUTE (UI without endpoint)

## Web calls that only wildcard-match (dynamic segment) — verify by hand

- `GET /api/products/export/${kind}?${exportFilters()}` — web/src/app/(main)/products/page.tsx:498 → backend `GET /api/products/export/pdf`, `GET /api/products/export/xlsx`

## Web calls hitting a path that exists with a different method


## Mobile calls with NO matching backend endpoint (method + path)

- (none)

## Mobile API methods DEFINED but never called from a screen (dead surface)

- `deleteProduct()` → DELETE /api/products/$id (api_service.dart:621)
- `payUdhaariEntry()` → POST /api/udhaari/$entryId/pay (api_service.dart:994)
- `getLowStockCount()` → GET /api/inventory/stock/low (api_service.dart:1068)
- `getPnlReport()` → GET /api/reports/pnl (api_service.dart:1200)
- `getGstReport()` → GET /api/reports/gst (api_service.dart:1210)

## Backend HANDLERS not reached by web nor mobile (dedup of dual-mounted URLs)

- `GET /api/expense-categories/:id / /api/expenses/:id` (expense.routes.ts, expenseRoutes, auth=authenticate+requireStore)
- `DELETE /api/expense-categories/categories/:id / /api/expenses/categories/:id` (expense.routes.ts, expenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `GET /api/expense-categories/recurring / /api/expenses/recurring` (expense.routes.ts, expenseRoutes, auth=authenticate+requireStore)
- `POST /api/expense-categories/recurring / /api/expenses/recurring` (expense.routes.ts, expenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `DELETE /api/expense-categories/recurring/:id / /api/expenses/recurring/:id` (expense.routes.ts, expenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `PATCH /api/expense-categories/recurring/:id / /api/expenses/recurring/:id` (expense.routes.ts, expenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `POST /api/expense-categories/recurring/process-due / /api/expenses/recurring/process-due` (expense.routes.ts, expenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `GET /api/health / /health` (health.routes.ts, healthRoutes, auth=PUBLIC)
- `GET /api/health/ready / /health/ready` (health.routes.ts, healthRoutes, auth=PUBLIC)
- `GET /api/inventory/stock/low` (inventory.routes.ts, inventoryRoutes, auth=authenticate+requireStore)
- `GET /api/plans` (plan.routes.ts, planRoutes, auth=PUBLIC)
- `POST /api/products/:id/restore` (product.routes.ts, productRoutes, auth=authenticate+requireStore)
- `GET /api/products/template` (product-export.routes.ts, productExportRoutes, auth=authenticate)
- `POST /api/recurring-expenses/recurring/process-due` (expense.routes.ts, recurringExpenseRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore)
- `DELETE /api/sales/held/:id` (sale.routes.ts, saleRoutes, auth=authenticate+requireStore)
- `GET /api/sales/held/:id` (sale.routes.ts, saleRoutes, auth=authenticate+requireStore)
- `GET /api/sales/held/list` (sale.routes.ts, saleRoutes, auth=authenticate+requireStore)
- `POST /api/sales/hold` (sale.routes.ts, saleRoutes, auth=authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER)+requireStore)
- `GET /api/store/staff` (store.routes.ts, storeRoutes, auth=authenticate+requireRole(ROLES.OWNER)+requireStore)
- `POST /api/store/staff` (store.routes.ts, storeRoutes, auth=authenticate+requireRole(ROLES.OWNER)+requireStore)
- `PATCH /api/store/staff/:id` (store.routes.ts, storeRoutes, auth=authenticate+requireRole(ROLES.OWNER)+requireStore)
- `POST /api/superadmin/plans` (superadmin-plans.routes.ts, superadminPlanRoutes, auth=requireSuperAdmin(plugin hook))
- `DELETE /api/superadmin/plans/:id` (superadmin-plans.routes.ts, superadminPlanRoutes, auth=requireSuperAdmin(plugin hook))
- `GET /api/superadmin/plans/:id` (superadmin-plans.routes.ts, superadminPlanRoutes, auth=requireSuperAdmin(plugin hook))
- `PATCH /api/superadmin/plans/:id` (superadmin-plans.routes.ts, superadminPlanRoutes, auth=requireSuperAdmin(plugin hook))
- `GET /api/suppliers/:id/payments` (supplier.routes.ts, supplierRoutes, auth=authenticate+requireStore)
- `POST /api/users/invite/accept` (user.routes.ts, userRoutes, auth=authenticate)
- `POST /api/webhooks/razorpay` (webhook.routes.ts, webhookRoutes, auth=PUBLIC)
- `POST /api/webhooks/razorpay/validate` (webhook.routes.ts, webhookRoutes, auth=PUBLIC)

(29 unused handlers of 146 handlers / 162 URLs)

## Backend endpoints called by web but not mobile

- `POST /api/auth/recovery/initiate` (recovery.routes.ts)
- `POST /api/auth/recovery/reset-pin` (recovery.routes.ts)
- `POST /api/auth/recovery/verify-otp` (recovery.routes.ts)
- `GET /api/customers/:id` (customer.routes.ts)
- `GET /api/expense-categories/categories` (expense.routes.ts)
- `POST /api/expense-categories/categories` (expense.routes.ts)
- `GET /api/merchant/verify-context` (recovery.routes.ts)
- `DELETE /api/products/:id` (product.routes.ts)
- `GET /api/products/export/pdf` (product-export.routes.ts)
- `GET /api/products/export/xlsx` (product-export.routes.ts)
- `POST /api/products/import` (product-import.routes.ts)
- `POST /api/products/import/pdf` (product-import.routes.ts)
- `POST /api/products/import/preview` (product-import.routes.ts)
- `POST /api/products/import/sheets` (product-import.routes.ts)
- `GET /api/products/template.csv` (product-export.routes.ts)
- `GET /api/products/template.xlsx` (product-export.routes.ts)
- `GET /api/purchase-orders` (purchase-order.routes.ts)
- `POST /api/purchase-orders` (purchase-order.routes.ts)
- `DELETE /api/purchase-orders/:id` (purchase-order.routes.ts)
- `GET /api/purchase-orders/:id` (purchase-order.routes.ts)
- `PATCH /api/purchase-orders/:id` (purchase-order.routes.ts)
- `PATCH /api/purchase-orders/:id/status` (purchase-order.routes.ts)
- `GET /api/purchases/:id` (purchase.routes.ts)
- `POST /api/recurring-expenses` (expense.routes.ts)
- `DELETE /api/recurring-expenses/:id` (expense.routes.ts)
- `PATCH /api/recurring-expenses/:id` (expense.routes.ts)
- `GET /api/recurring-expenses/recurring` (expense.routes.ts)
- `GET /api/reports/gst` (report.routes.ts)
- `GET /api/reports/pnl` (report.routes.ts)
- `GET /api/reports/stock/current` (report.routes.ts)
- `GET /api/reports/stock/movements` (report.routes.ts)
- `GET /api/roles` (role.routes.ts)
- `PATCH /api/roles/:role` (role.routes.ts)
- `GET /api/sales/:id` (sale.routes.ts)
- `GET /api/sales/:id/invoice` (sale.routes.ts)
- `GET /api/sales/:id/invoice/pdf` (sale.routes.ts)
- `POST /api/store/setup` (store.routes.ts)
- `POST /api/superadmin/auth/login` (superadmin-auth.routes.ts)
- `POST /api/superadmin/auth/logout` (superadmin-auth.routes.ts)
- `GET /api/superadmin/auth/me` (superadmin-auth.routes.ts)
- `GET /api/superadmin/billing` (superadmin.routes.ts)
- `GET /api/superadmin/logs` (superadmin.routes.ts)
- `GET /api/superadmin/plans` (superadmin-plans.routes.ts)
- `POST /api/superadmin/plans/:id/duplicate` (superadmin-plans.routes.ts)
- `PATCH /api/superadmin/plans/:id/status` (superadmin-plans.routes.ts)
- `GET /api/superadmin/settings` (superadmin.routes.ts)
- `PATCH /api/superadmin/settings` (superadmin.routes.ts)
- `GET /api/superadmin/tenants` (superadmin.routes.ts)
- `GET /api/superadmin/tenants/:id` (superadmin.routes.ts)
- `POST /api/superadmin/tenants/:id/impersonate` (superadmin.routes.ts)
- `PATCH /api/superadmin/tenants/:id/plan` (superadmin-plans.routes.ts)
- `PATCH /api/superadmin/tenants/:id/status` (superadmin.routes.ts)
- `GET /api/superadmin/tenants/:id/users` (superadmin.routes.ts)
- `GET /api/suppliers/:id` (supplier.routes.ts)
- `POST /api/suppliers/:id/payments` (supplier.routes.ts)
- `GET /api/suppliers/:id/reorder-message` (supplier.routes.ts)
- `POST /api/udhaari/:id/pay` (udhaari.routes.ts)
- `POST /api/uploads/image` (upload.routes.ts)
- `DELETE /api/users/:id` (user.routes.ts)
- `DELETE /api/users/invite/:id` (user.routes.ts)
- `POST /api/users/invite/:id/resend` (user.routes.ts)

(61)

## Backend endpoints called by mobile but not web

- `POST /api/auth/refresh` (auth.routes.ts)
- `GET /api/expenses/categories` (expense.routes.ts)
- `POST /api/suppliers/:id/invoice` (supplier.routes.ts)

(3)

## Web endpoints not called by mobile (same as above, from the web side)

- `GET /api/customers/:x` — web/src/app/(main)/customers/page.tsx:140
- `GET /api/expense-categories/categories` — web/src/app/(main)/expenses/page.tsx:93
- `GET /api/recurring-expenses/recurring` — web/src/app/(main)/expenses/page.tsx:134
- `DELETE /api/recurring-expenses/:x` — web/src/app/(main)/expenses/page.tsx:178
- `PATCH /api/recurring-expenses/:x` — web/src/app/(main)/expenses/page.tsx:192
- `GET /api/sales/:x/invoice` — web/src/app/(main)/invoices/page.tsx:248
- `GET /api/sales/:x` — web/src/app/(main)/invoices/page.tsx:281
- `GET /api/sales/:x/invoice/pdf` — web/src/app/(main)/invoices/page.tsx:775
- `POST /api/products/import/preview` — web/src/app/(main)/products/import-dialog.tsx:94
- `POST /api/products/import` — web/src/app/(main)/products/import-dialog.tsx:115
- `POST /api/products/import/pdf` — web/src/app/(main)/products/import-dialog.tsx:177
- `POST /api/products/import/sheets` — web/src/app/(main)/products/import-dialog.tsx:225
- `DELETE /api/products/:x` — web/src/app/(main)/products/page.tsx:388
- `GET /api/products/export/:x` — web/src/app/(main)/products/page.tsx:498
- `GET /api/products/template.csv` — web/src/app/(main)/products/page.tsx:600
- `GET /api/products/template.xlsx` — web/src/app/(main)/products/page.tsx:603
- `GET /api/purchases/:x` — web/src/app/(main)/purchases/page.tsx:164
- `GET /api/reports/stock/current` — web/src/app/(main)/reports/page.tsx:199
- `GET /api/reports/stock/movements` — web/src/app/(main)/reports/page.tsx:200
- `GET /api/reports/gst` — web/src/app/(main)/reports/page.tsx:201
- `GET /api/reports/pnl` — web/src/app/(main)/reports/page.tsx:202
- `DELETE /api/users/:x` — web/src/app/(main)/settings/page.tsx:187
- `POST /api/users/invite/:x/resend` — web/src/app/(main)/settings/page.tsx:197
- `DELETE /api/users/invite/:x` — web/src/app/(main)/settings/page.tsx:207
- `GET /api/suppliers/:x` — web/src/app/(main)/suppliers/[id]/page.tsx:46
- `GET /api/suppliers/:x/reorder-message` — web/src/app/(main)/suppliers/[id]/page.tsx:62
- `GET /api/purchase-orders` — web/src/app/(main)/suppliers/orders/page.tsx:77
- `GET /api/purchase-orders/:x` — web/src/app/(main)/suppliers/orders/page.tsx:97
- `PATCH /api/purchase-orders/:x/status` — web/src/app/(main)/suppliers/orders/page.tsx:108
- `POST /api/udhaari/:x/pay` — web/src/app/(main)/udhaari/page.tsx:360
- `GET /api/roles` — web/src/app/(main)/users/page.tsx:64
- `PATCH /api/roles/:x` — web/src/app/(main)/users/page.tsx:160
- `POST /api/store/setup` — web/src/app/onboard/page.tsx:174
- `GET /api/superadmin/billing` — web/src/app/superadmin/billing/page.tsx:51
- `GET /api/superadmin/tenants` — web/src/app/superadmin/dashboard/page.tsx:46
- `GET /api/superadmin/logs` — web/src/app/superadmin/logs/page.tsx:42
- `GET /api/superadmin/plans` — web/src/app/superadmin/plans/page.tsx:43
- `POST /api/superadmin/plans/:x/duplicate` — web/src/app/superadmin/plans/page.tsx:89
- `PATCH /api/superadmin/plans/:x/status` — web/src/app/superadmin/plans/page.tsx:105
- `GET /api/superadmin/settings` — web/src/app/superadmin/settings/page.tsx:22
- `PATCH /api/superadmin/settings` — web/src/app/superadmin/settings/page.tsx:47
- `GET /api/superadmin/tenants/:x` — web/src/app/superadmin/tenants/[id]/page.tsx:81
- `GET /api/superadmin/tenants/:x/users` — web/src/app/superadmin/tenants/[id]/page.tsx:82
- `PATCH /api/superadmin/tenants/:x/status` — web/src/app/superadmin/tenants/[id]/page.tsx:109
- `PATCH /api/superadmin/tenants/:x/plan` — web/src/app/superadmin/tenants/[id]/page.tsx:134
- `POST /api/superadmin/tenants/:x/impersonate` — web/src/app/superadmin/tenants/[id]/page.tsx:155
- `POST /api/expense-categories/categories` — web/src/components/expenses/category-form-dialog.tsx:39
- `POST /api/uploads/image` — web/src/components/expenses/expense-form-dialog.tsx:69
- `POST /api/recurring-expenses` — web/src/components/expenses/recurring-expense-dialog.tsx:88
- `POST /api/superadmin/auth/login` — web/src/components/login/LoginClient.tsx:214
- `POST /api/auth/recovery/initiate` — web/src/components/recovery/RecoveryClient.tsx:90
- `POST /api/auth/recovery/verify-otp` — web/src/components/recovery/RecoveryClient.tsx:115
- `POST /api/auth/recovery/reset-pin` — web/src/components/recovery/RecoveryClient.tsx:156
- `GET /api/merchant/verify-context` — web/src/components/recovery/StepIdentity.tsx:58
- `POST /api/suppliers/:x/payments` — web/src/components/suppliers/payment-dialog.tsx:64
- `DELETE /api/purchase-orders/:x` — web/src/components/suppliers/po-detail-dialog.tsx:99
- `PATCH /api/purchase-orders/:x` — web/src/components/suppliers/po-form-dialog.tsx:146
- `POST /api/purchase-orders` — web/src/components/suppliers/po-form-dialog.tsx:149
- `GET /api/superadmin/auth/me` — web/src/lib/superadmin-store.ts:45
- `POST /api/superadmin/auth/logout` — web/src/lib/superadmin-store.ts:72
