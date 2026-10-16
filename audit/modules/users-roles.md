# USERS_ROLES

Users list/edit/role wired on web; mobile can change a user role. `POST /api/users/invite/accept` is dead (see P0 in README). `/api/store/staff*` duplicates `/api/users*` and is unused. Role-matrix endpoints used by web settings.

Handlers: **13** | web: 9 | mobile: 4 | neither: 4

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/roles` | authenticate+requireStore | yes | no | role.routes.ts |
| PATCH | `/api/roles/:role` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | no | role.routes.ts |
| GET | `/api/store/staff` | authenticate+requireRole(ROLES.OWNER)+requireStore | no | no | store.routes.ts |
| POST | `/api/store/staff` | authenticate+requireRole(ROLES.OWNER)+requireStore | no | no | store.routes.ts |
| PATCH | `/api/store/staff/:id` | authenticate+requireRole(ROLES.OWNER)+requireStore | no | no | store.routes.ts |
| GET | `/api/users` | authenticate+requireRole(ROLES.OWNER,ROLES.MANAGER)+requireStore | yes | yes | user.routes.ts |
| DELETE | `/api/users/:id` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | no | user.routes.ts |
| PATCH | `/api/users/:id` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | yes | user.routes.ts |
| PATCH | `/api/users/:id/status` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | yes | user.routes.ts |
| POST | `/api/users/invite` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | yes | user.routes.ts |
| DELETE | `/api/users/invite/:id` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | no | user.routes.ts |
| POST | `/api/users/invite/:id/resend` | authenticate+requireRole(ROLES.OWNER)+requireStore | yes | no | user.routes.ts |
| POST | `/api/users/invite/accept` | authenticate | no | no | user.routes.ts |
