# BILLING

Razorpay order/verify/webhook wired on both platforms. Fully integrated.

Handlers: **2** | web: 2 | mobile: 2 | neither: 0

| method | path | auth | web | mobile | file |
|---|---|---|---|---|---|
| GET | `/api/payments` | authenticate+requireStore | yes | yes | payment.routes.ts |
| POST | `/api/payments/receive` | authenticate+requireStore | yes | yes | payment.routes.ts |
