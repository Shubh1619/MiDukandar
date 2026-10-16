import "./lib/env.js";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { ApiError } from "./lib/api-error.js";
import { rateLimitKey } from "./lib/rate-limit-key.js";
import { STORAGE_URL_PREFIX } from "./lib/storage.js";

import { authRoutes } from "./routes/auth.routes.js";
import { storeRoutes } from "./routes/store.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { customerRoutes } from "./routes/customer.routes.js";
import { saleRoutes } from "./routes/sale.routes.js";
import { purchaseRoutes } from "./routes/purchase.routes.js";
import { inventoryRoutes } from "./routes/inventory.routes.js";
import { paymentRoutes } from "./routes/payment.routes.js";
import { udhaariRoutes } from "./routes/udhaari.routes.js";
import { reportRoutes } from "./routes/report.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { uploadRoutes } from "./routes/upload.routes.js";
import { recoveryRoutes, merchantVerifyRoutes } from "./routes/recovery.routes.js";
import { superadminAuthRoutes } from "./routes/superadmin-auth.routes.js";
import { superadminRoutes } from "./routes/superadmin.routes.js";
import { superadminPlanRoutes } from "./routes/superadmin-plans.routes.js";
import { planRoutes } from "./routes/plan.routes.js";
import { supplierRoutes } from "./routes/supplier.routes.js";
import { purchaseOrderRoutes } from "./routes/purchase-order.routes.js";
import { expenseRoutes, recurringExpenseRoutes } from "./routes/expense.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { roleRoutes } from "./routes/role.routes.js";
import { settingsRoutes } from "./routes/settings.routes.js";
import { authenticate, requireModuleAccess } from "./middlewares/auth.js";

const require = createRequire(import.meta.url);

const PLAN_ROUTE_MODULES: Array<[string, string]> = [
  ["/api/reports/dashboard", "DASHBOARD"],
  ["/api/products", "PRODUCTS"],
  ["/api/inventory", "INVENTORY"],
  ["/api/sales", "SALES_INVOICES"],
  ["/api/payments", "BILLING"],
  ["/api/customers", "CUSTOMERS_UDHAARI"],
  ["/api/udhaari", "CUSTOMERS_UDHAARI"],
  ["/api/suppliers", "SUPPLIERS"],
  ["/api/purchases", "PURCHASES"],
  ["/api/purchase-orders", "PURCHASES"],
  ["/api/expenses", "EXPENSES"],
  ["/api/expense-categories", "EXPENSES"],
  ["/api/recurring-expenses", "EXPENSES"],
  ["/api/reports", "GST_REPORTS"],
  ["/api/store/staff", "USERS_ROLES"],
  ["/api/users", "USERS_ROLES"],
  ["/api/roles", "USERS_ROLES"],
];

function planModuleForPath(path: string): string | null {
  if (path === "/api/users/invite/accept") return null;
  return PLAN_ROUTE_MODULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? null;
}

export function buildApp(opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
    // Trust exactly TRUST_PROXY_HOPS reverse-proxy hops (default 1: the Next.js
    // proxy in front of the API). `true` resolves the client IP from the
    // LEFT-MOST X-Forwarded-For entry, which the client itself controls — that
    // let anyone rotate the header to get a fresh rate-limit bucket. A hop count
    // reads the entry the real proxy appended, which cannot be forged.
    trustProxy: config.trustProxyHops,
    bodyLimit: 5 * 1024 * 1024,
    ...opts,
  });

  if (config.sentryDsn) {
    const Sentry = require("@sentry/node");
    Sentry.init({ dsn: config.sentryDsn, environment: config.nodeEnv, tracesSampleRate: 0.05 });
  }

  // Capture raw body for webhook signature verification while parsing JSON.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    try {
      const raw = String(body ?? "");
      (request as { rawBody?: Buffer }).rawBody = Buffer.from(raw, "utf8");
      done(null, raw.trim() ? JSON.parse(raw) : {});
    } catch (err) {
      // A malformed body is a client error. Fastify's own JSON parser tags this
      // with a 400 / FST_ERR_CTP_INVALID_JSON, but replacing the parser (needed
      // for the raw-body webhook signature check) hands `done` a bare
      // SyntaxError with no statusCode, so the error handler fell through to
      // its 500 branch. That mislabels bad input from any client as a server
      // fault, sends a useless "Internal server error", and pollutes Sentry.
      const parseError = err as Error & { statusCode?: number; code?: string };
      parseError.statusCode = 400;
      parseError.code = "FST_ERR_CTP_INVALID_JSON";
      done(parseError);
    }
  });

  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile native apps, curl, Postman).
      if (!origin) return cb(null, true);
      // Explicit allow-list from CORS_ALLOWED_ORIGINS (production).
      if (config.corsAllowedOrigins.includes(origin)) return cb(null, true);
      // Non-production only: allow any localhost origin regardless of port.
      // Flutter web dev builds use a dynamic port each run (e.g.
      // localhost:56224), and Next.js dev may hop ports too. Production must
      // rely solely on the explicit allow-list above.
      if (!config.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new ApiError(403, "CORS_DENIED", "Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.register(jwt, { secret: config.jwtAccessSecret });
  app.register(cookie, {
    parseOptions: {
      // Controls how incoming Cookie headers are PARSED, not how Set-Cookie is
      // serialized: each setCookie() call declares httpOnly explicitly, so the
      // superadmin session cookie is still emitted HttpOnly. Read by
      // /api/auth/refresh + /logout and by the superadmin guard.
      httpOnly: false,
    },
  });
  app.register(rateLimit, {
    max: config.rateLimitMaxRequests,
    timeWindow: config.rateLimitWindowMs,
    // Keyed on the socket-anchored client IP (see lib/rate-limit-key.ts): the
    // X-Forwarded-For value is only honoured for requests that actually arrived
    // through a trusted proxy hop, so rotating the header no longer mints a
    // fresh bucket.
    keyGenerator: rateLimitKey,
    // @fastify/rate-limit `throw`s whatever this builder returns, so it must be
    // an Error carrying statusCode 429. Returning a bare object left the
    // central handler with no statusCode: every rate-limit trip was reported as
    // a 500 "Internal server error" (and sent to Sentry) instead of the 429 the
    // error contract advertises, so clients could not back off correctly.
    errorResponseBuilder: () => {
      const err = new Error("Too many requests. Please slow down.") as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 429;
      err.code = "RATE_LIMITED";
      return err;
    },
  });
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  // Serve stored uploads from the local uploads directory. Registered before
  // the plan-module onRoute hook below so these public asset GETs stay
  // unauthenticated. The directory is created on boot (a fresh checkout or
  // container has no uploads/ yet) — @fastify/static throws on a missing root.
  mkdirSync(config.uploadDir, { recursive: true });
  app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: `${STORAGE_URL_PREFIX}/`,
  });

  app.addHook("onRoute", (routeOptions) => {
    const moduleKey = planModuleForPath(routeOptions.url);
    if (!moduleKey) return;
    const existing = routeOptions.preHandler
      ? Array.isArray(routeOptions.preHandler)
        ? [...routeOptions.preHandler]
        : [routeOptions.preHandler]
      : [];
    if (!existing.length) existing.push(authenticate);
    existing.push(requireModuleAccess(moduleKey));
    routeOptions.preHandler = existing;
  });

  // Central error handler → structured JSON errors + Sentry capture
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      logger.warn("api error", {
        path: request.url,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
      void reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    if (error.statusCode === 429) {
      void reply.status(429).send({ error: "Too many requests. Please slow down.", code: "RATE_LIMITED" });
      return;
    }

    if (error.name === "ZodError") {
      void reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    // Not every error reaching this branch is a server fault. Anything the
    // client got wrong — an unparseable body, an unsupported media type, a bad
    // content length — arrives as a bare Error carrying a 4xx statusCode.
    // Reporting those at error level and forwarding them to Sentry made
    // ordinary client mistakes look like server outages and buried real
    // incidents in the noise, so only genuine 5xx faults are captured.
    if (status >= 500) {
      logger.error("unhandled error", {
        path: request.url,
        error: { name: error.name, message: error.message, stack: error.stack },
      });
      if (config.sentryDsn) require("@sentry/node").captureException(error);
    } else {
      logger.warn("client error", {
        path: request.url,
        code: error.code,
        message: error.message,
        statusCode: status,
      });
    }
    void reply.status(status).send({
      error: status === 500 ? "Internal server error" : error.message,
      code: error.code ?? "UNKNOWN",
    });
  });

  // request logging
  app.addHook("onResponse", (request, reply, done) => {
    if (opts.logger) {
      logger.info("request", {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
      });
    }
    done();
  });

  registerRoutes(app);
  return app;
}

function registerRoutes(app: FastifyInstance) {
  app.register(healthRoutes, { prefix: "/health" });
  app.register(healthRoutes, { prefix: "/api/health" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(recoveryRoutes, { prefix: "/api/auth/recovery" });
  app.register(merchantVerifyRoutes, { prefix: "/api/merchant" });
  app.register(storeRoutes, { prefix: "/api/store" });
  app.register(productRoutes, { prefix: "/api/products" });
  app.register(customerRoutes, { prefix: "/api/customers" });
  app.register(supplierRoutes, { prefix: "/api/suppliers" });
  app.register(purchaseOrderRoutes, { prefix: "/api/purchase-orders" });
  app.register(expenseRoutes, { prefix: "/api/expenses" });
  app.register(expenseRoutes, { prefix: "/api/expense-categories" });
  app.register(recurringExpenseRoutes, { prefix: "/api/recurring-expenses" });
  app.register(saleRoutes, { prefix: "/api/sales" });
  app.register(purchaseRoutes, { prefix: "/api/purchases" });
  app.register(inventoryRoutes, { prefix: "/api/inventory" });
  app.register(paymentRoutes, { prefix: "/api/payments" });
  app.register(udhaariRoutes, { prefix: "/api/udhaari" });
  app.register(reportRoutes, { prefix: "/api/reports" });
  app.register(userRoutes, { prefix: "/api/users" });
  app.register(roleRoutes, { prefix: "/api/roles" });
  app.register(settingsRoutes, { prefix: "/api/settings" });
  app.register(webhookRoutes, { prefix: "/api/webhooks" });
  app.register(uploadRoutes, { prefix: "/api/uploads" });
  app.register(superadminAuthRoutes, { prefix: "/api/superadmin/auth" });
  app.register(superadminRoutes, { prefix: "/api/superadmin" });
  app.register(superadminPlanRoutes, { prefix: "/api/superadmin" });
  app.register(planRoutes, { prefix: "/api/plans" });
}
