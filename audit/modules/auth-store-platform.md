# UNGATED

Auth, store setup/onboarding, plans, superadmin, webhooks, uploads and health. See sub-sections below.

Handlers: **41** | web: 31 | mobile: 10 | neither: 9

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| POST | `/api/auth/login-kind` | PUBLIC | yes | yes | auth.routes.ts |
| POST | `/api/auth/logout` | PUBLIC | yes | yes | auth.routes.ts |
| GET | `/api/auth/me` | authenticate | yes | yes | auth.routes.ts |
| POST | `/api/auth/otp/request` | PUBLIC | yes | yes | auth.routes.ts |
| POST | `/api/auth/otp/verify` | PUBLIC | yes | yes | auth.routes.ts |
| POST | `/api/auth/recovery/initiate` | PUBLIC | yes | no | recovery.routes.ts |
| POST | `/api/auth/recovery/reset-pin` | PUBLIC | yes | no | recovery.routes.ts |
| POST | `/api/auth/recovery/verify-otp` | PUBLIC | yes | no | recovery.routes.ts |
| POST | `/api/auth/refresh` | PUBLIC | no | yes | auth.routes.ts |
| POST | `/api/auth/register` | PUBLIC | yes | yes | auth.routes.ts |
| GET | `/api/health` | PUBLIC | no | no | health.routes.ts |
| GET | `/api/health/ready` | PUBLIC | no | no | health.routes.ts |
| GET | `/api/merchant/verify-context` | PUBLIC | yes | no | recovery.routes.ts |
| GET | `/api/plans` | PUBLIC | no | no | plan.routes.ts |
| PATCH | `/api/settings/language` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | settings.routes.ts |
| GET | `/api/store` | authenticate+requireStore | yes | yes | store.routes.ts |
| PUT | `/api/store` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | store.routes.ts |
| POST | `/api/store/setup` | authenticate+requireRole(ROLES.OWNER,ROLES.CASHIER) | yes | no | store.routes.ts |
| POST | `/api/superadmin/auth/login` | PUBLIC | yes | no | superadmin-auth.routes.ts |
| POST | `/api/superadmin/auth/logout` | PUBLIC | yes | no | superadmin-auth.routes.ts |
| GET | `/api/superadmin/auth/me` | requireSuperAdmin | yes | no | superadmin-auth.routes.ts |
| GET | `/api/superadmin/billing` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| GET | `/api/superadmin/logs` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| GET | `/api/superadmin/plans` | requireSuperAdmin(plugin hook) | yes | no | superadmin-plans.routes.ts |
| POST | `/api/superadmin/plans` | requireSuperAdmin(plugin hook) | no | no | superadmin-plans.routes.ts |
| DELETE | `/api/superadmin/plans/:id` | requireSuperAdmin(plugin hook) | no | no | superadmin-plans.routes.ts |
| GET | `/api/superadmin/plans/:id` | requireSuperAdmin(plugin hook) | no | no | superadmin-plans.routes.ts |
| PATCH | `/api/superadmin/plans/:id` | requireSuperAdmin(plugin hook) | no | no | superadmin-plans.routes.ts |
| POST | `/api/superadmin/plans/:id/duplicate` | requireSuperAdmin(plugin hook) | yes | no | superadmin-plans.routes.ts |
| PATCH | `/api/superadmin/plans/:id/status` | requireSuperAdmin(plugin hook) | yes | no | superadmin-plans.routes.ts |
| GET | `/api/superadmin/settings` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| PATCH | `/api/superadmin/settings` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| GET | `/api/superadmin/tenants` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| GET | `/api/superadmin/tenants/:id` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| POST | `/api/superadmin/tenants/:id/impersonate` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| PATCH | `/api/superadmin/tenants/:id/plan` | requireSuperAdmin(plugin hook) | yes | no | superadmin-plans.routes.ts |
| PATCH | `/api/superadmin/tenants/:id/status` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| GET | `/api/superadmin/tenants/:id/users` | requireSuperAdmin(plugin hook) | yes | no | superadmin.routes.ts |
| POST | `/api/uploads/image` | authenticate+requireStore | yes | no | upload.routes.ts |
| POST | `/api/webhooks/razorpay` | PUBLIC | no | no | webhook.routes.ts |
| POST | `/api/webhooks/razorpay/validate` | PUBLIC | no | no | webhook.routes.ts |
