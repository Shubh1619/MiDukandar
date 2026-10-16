# MiDukandar

Business management platform: **backend** (Fastify + Postgres), **app** (Flutter),
**web** (Next.js). Everything is driven by environment variables so the same
code runs in two environments:

| Environment | How it runs | Mail mode |
| ----------- | ----------- | --------- |
| **Local** (`NODE_ENV=development`) | `backend/.env.local` + docker-compose | `MAIL_MODE=log` (emails/OTP printed to console) |
| **Render** (`NODE_ENV=production`) | Render dashboard env vars | `MAIL_MODE=brevo` (Brevo HTTP API) |

---

## Run locally

### Prerequisites

- Node 22+, npm
- Docker + docker compose (recommended for the full stack)
- Flutter 3.44+ (only for the mobile app)

### 1. Backend + database via Docker (recommended)

The repo root `.env` already contains working local values (they are gitignored).

```bash
docker compose -f docker-compose.yml up -d --build
```

- Postgres → `localhost:5433`
- Backend API → `http://localhost:4000`
- Web → `http://localhost:3000`

Migrations run automatically before the API starts. Seed demo data:

```bash
npm run seed:dev --prefix backend
```

The startup log prints the active environment, mail mode, DB host and the
current migration version, e.g.

```
{"level":"info","msg":"startup","env":"development","mailMode":"log","dbHost":"db","migration":"020_xxx.sql"}
```

### 2. Backend without Docker

```bash
cd backend
cp .env.example .env.local      # then set DATABASE_URL to localhost:5432
npm install
npm run migrate                 # apply schema
npm run seed:dev                # demo store/products/customers
npm run dev                     # http://localhost:4000
```

`npm run dev` loads `.env.local` first (then `.env`). With
`NODE_ENV=development` the API refuses to start against a non-local
`DATABASE_URL` unless `ALLOW_REMOTE_DB_IN_DEV=true`.

### 3. Web (Next.js)

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` should stay **empty** locally — the browser uses the
same-origin Next.js proxy at `/api/*`, so there is no CORS issue. The proxy
forwards to `BACKEND_URL` (default `http://localhost:4000`).

### 4. Flutter app

The API base URL is injected with `--dart-define=API_URL=…`. It is never
hardcoded; without it the app defaults to `http://localhost:4000`.

```bash
cd app
flutter pub get

# desktop / web / iOS simulator (host backend on :4000)
flutter run --dart-define=API_URL=http://localhost:4000

# Android emulator (the host is 10.0.2.2 from inside the emulator)
flutter run --dart-define=API_URL=http://10.0.2.2:4000

# production API
flutter run --dart-define=API_URL=https://<service>.onrender.com
```

Equivalent VS Code launch configurations live in `.vscode/launch.json`
("Flutter: Local API", "Flutter: Android emulator", "Flutter: Render").

### Mail / OTP in local development

- `MAIL_MODE=log` → no email is sent; the full message (including the OTP)
  is printed to the backend console.
- `OTP_MASTER=000000` is a universal OTP bypass that is honoured **only** when
  `NODE_ENV != production` (set to production it refuses to boot instead).
- `MAIL_MODE=brevo` requires `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`; the API
  refuses to boot if they are missing.

---

## Deploy to Render

The repo ships a multi-stage `Dockerfile` whose final `production` target runs
the API **and** Next.js together in one container:

- Next.js (standalone) → Render `PORT` (e.g. 4000)
- Fastify API → internal `API_PORT` (5000); Next.js proxies `/api/*` to it
- `docker-entrypoint.sh` runs migrations, bootstraps the superadmin, then starts both

Create a **Web Service** from the repo root (Dockerfile, root directory). Then
set these environment variables in the Render dashboard:

| Variable | Value |
| -------- | ----- |
| `NODE_ENV` | `production` |
| `MAIL_MODE` | `brevo` |
| `BREVO_API_KEY` | your Brevo API key |
| `BREVO_SENDER_EMAIL` | verified sender address |
| `DATABASE_URL` | managed Postgres connection string (pooled) |
| `DIRECT_URL` | non-pooler endpoint (used for migrations) |
| `JWT_ACCESS_SECRET` | random, ≥ 32 chars (**different from local**) |
| `JWT_REFRESH_SECRET` | random, ≥ 32 chars |
| `SUPERADMIN_JWT_SECRET` | random, ≥ 32 chars |
| `APP_URL` | `https://<service>.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://<service>.onrender.com` |
| `RAZORPAY_*` | optional; `RAZORPAY_WEBHOOK_SECRET` required if keys are set |

Notes:

- `OTP_MASTER` must be **unset** in production (boot fails if set).
- Migrations run on every deploy from `backend/migrations`; local and Render
  must be on the same schema version (the startup log prints it).
- Release the Flutter app against Render with
  `flutter build apk --dart-define=API_URL=https://<service>.onrender.com`.
- For `NEXT_PUBLIC_API_URL`: leave it empty if the API is same-origin behind the
  Next.js proxy; set it only when the browser must call another origin.

---

## Release checklist

- [ ] `NODE_ENV=production`
- [ ] Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SUPERADMIN_JWT_SECRET`
      (must differ from the local development values)
- [ ] Unset `OTP_MASTER` (a universal OTP bypass)
- [ ] `MAIL_MODE=brevo` with valid `BREVO_API_KEY` + `BREVO_SENDER_EMAIL`
      (Brevo account IP allow-list must include the Render egress IP)
- [ ] `DATABASE_URL` / `DIRECT_URL` point at the production database
- [ ] `APP_URL` and `CORS_ALLOWED_ORIGINS` set to the real `https://` origin
- [ ] `REFRESH_COOKIE_SECURE` resolved (defaults to Secure when `APP_URL` is https)
- [ ] `RAZORPAY_WEBHOOK_SECRET` set if Razorpay keys are configured
- [ ] `npm run migrate` applied; startup log shows the expected migration version
- [ ] Sign in with a **real** email and confirm the OTP arrives
- [ ] Confirm a local dev token is rejected by production (different JWT secret)
- [ ] `npm run seed:dev` is never run against production (it refuses in production)

---

## Scripts (backend)

```bash
npm run dev        # local server (loads .env.local then .env)
npm run build      # tsc -> dist
npm run start      # run the built server (production)
npm run migrate    # apply pending migrations
npm run seed:dev   # demo data — refuses when NODE_ENV=production
npm run lint
npm run typecheck
```
