# GST_REPORTS

P&L, GST and stock reports used by web (6/6). Mobile reaches only sales/purchases reports (2/6); `getPnlReport`/`getGstReport` exist in `api_service.dart` but are never called, and mobile has NO reports screen.

Handlers: **6** | web: 6 | mobile: 2 | neither: 0

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/reports/gst` | authenticate+requireStore | yes | no | report.routes.ts |
| GET | `/api/reports/pnl` | authenticate+requireStore | yes | no | report.routes.ts |
| GET | `/api/reports/purchases` | authenticate+requireStore | yes | yes | report.routes.ts |
| GET | `/api/reports/sales` | authenticate+requireStore | yes | yes | report.routes.ts |
| GET | `/api/reports/stock/current` | authenticate+requireStore | yes | no | report.routes.ts |
| GET | `/api/reports/stock/movements` | authenticate+requireStore | yes | no | report.routes.ts |
