# Platform gaps — web vs mobile

"Web-only" means the handler is called by web and not by mobile; "mobile-only" the
reverse. Web-only is expected for admin/POS flows; mobile-only entries are usually just
an alternate URL for the same handler.

## Mobile-only endpoints

| endpoint | note |
|---|---|
| `POST /api/auth/refresh` | mobile refreshes JWT explicitly; web refreshes via cookie middleware. |
| `GET /api/expenses/categories` | dual mount of `GET /api/expense-categories/categories` (web uses the other URL). |
| `POST /api/suppliers/:id/invoice` | mobile records a supplier invoice; web uses the purchase-order flow instead. |

## Capabilities present on web but ABSENT on mobile

| capability | backend handlers (web) | mobile status |
|---|---|---|
| Reports (P&L, GST, stock) | `report.routes.ts` (6) | **No screen.** Only 2/6 reached; `getPnlReport`/`getGstReport` exist in `api_service.dart` but are never called. |
| Purchase orders (create/edit/status/delete) | `purchase-order.routes.ts` (7) | **No screen.** Only `GET /api/purchases/:id` is used on mobile. |
| Product import / export / templates | `product-import.routes.ts`, `product-export.routes.ts` | mobile has no import/export UI. |
| Store setup / onboarding wizard | `POST /api/store/setup` | web-only. |
| Role permission matrix | `GET /api/roles`, `PATCH /api/roles/:role` | mobile can set a user's role (`PATCH /api/users/:id`) but cannot edit the role matrix. |
| Account recovery (OTP → reset PIN) | `recovery.routes.ts` (`/initiate`, `/verify-otp`, `/reset-pin`, `/merchant/verify-context`) | web-only. |
| Superadmin console | `superadmin*.routes.ts` | web-only (expected). |
| Supplier payment list (`GET /:id/payments`) | `supplier.routes.ts` | absent on **both** platforms. |
| Expense category edit/delete, expense detail | `expense.routes.ts` | absent on **both** platforms. |
| Held sales (park/resume) | `sale.routes.ts` (4) | absent on **both** platforms. |

## Capabilities present on mobile but not web

| capability | note |
|---|---|
| Supplier invoice entry (`POST /api/suppliers/:id/invoice`) | web uses purchase orders instead. |
| Expense categories via alias URL (`GET /api/expenses/categories`) | same handler as web's `/api/expense-categories/categories`. |

## Dead mobile API surface (`api_service.dart`)

Defined but never called from any screen (5 methods):

- `deleteProduct`
- `payUdhaariEntry` (mobile repays via `receiveCustomerPayment` → `POST /api/payments/receive`)
- `getLowStockCount` (the low-stock badge uses the stock list / report instead)
- `getPnlReport`
- `getGstReport`

Note: `_refreshTokenInternal` is private and IS called internally by `_request`. `login`
is not defined as a public helper (OTP-only login by design).
