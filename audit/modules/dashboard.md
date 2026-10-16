# DASHBOARD

Single summary endpoint, consumed by both web dashboard and mobile home. Fully integrated.

Handlers: **1** | web: 1 | mobile: 1 | neither: 0

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/reports/dashboard` | authenticate+requireStore | yes | yes | report.routes.ts |
