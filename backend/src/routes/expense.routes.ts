import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { qClient, withTx } from "../db/pool.js";
import { ApiError } from "../lib/api-error.js";
import { parse, paginationSchema } from "../lib/validate.js";
import { authenticate, requireStore, requireRole, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import {
  listExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  listRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  processDueRecurringExpenses,
} from "../services/expense.service.js";

const expenseCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
});

const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  categoryId: z.string().nullable().optional(),
  /** Free-text category name - resolved to an existing or new category when no `categoryId` is sent. */
  categoryName: z.string().min(1).max(60).nullish(),
  expenseDate: z.string().optional(),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "BANK"]).default("CASH"),
  note: z.string().max(500).optional().default(""),
  attachmentUrl: z.string().nullable().optional(),
});

const createRecurringSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  categoryId: z.string().nullable().optional(),
  frequency: z.enum(["MONTHLY", "WEEKLY"]).default("MONTHLY"),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "nextDueDate must be YYYY-MM-DD"),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "BANK"]).default("CASH"),
});

/**
 * Category handlers, bound by `expenseRoutes` (legacy `/categories` paths) and
 * by `expenseCategoryRoutes` (the REST-correct `/` and `/:id` paths too).
 */
function registerCategoryRoutes(app: FastifyInstance, restful: boolean) {
  const list = async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const categories = await listExpenseCategories(qClient(), storeId);
    return { categories };
  };

  const create = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const storeId = requireStore(request);
    const body = parse(expenseCategorySchema, request.body);
    const category = await createExpenseCategory(qClient(), storeId, body.name);
    return reply.status(201).send({ category });
  };

  const remove = async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const res = await deleteExpenseCategory(qClient(), storeId, id);
    return reply.send(res);
  };

  const writeGuard = { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] };

  app.get("/categories", { preHandler: authenticate }, list);
  app.post("/categories", writeGuard, create);
  app.delete("/categories/:id", writeGuard, remove);

  if (restful) {
    app.get("/", { preHandler: authenticate }, list);
    app.post("/", writeGuard, create);
    app.delete("/:id", writeGuard, remove);
  }
}

export async function expenseRoutes(app: FastifyInstance) {
  // --- CATEGORIES (legacy `/categories` paths; the REST-shaped `/` and `/:id`
  // expense handlers below own those paths in this plugin) ---
  registerCategoryRoutes(app, false);

  // --- EXPENSES SUMMARY ---
  app.get("/summary", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const summary = await getExpenseSummary(qClient(), storeId);
    return summary;
  });

  // --- EXPENSES CRUD ---
  app.get("/", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const query = parse(
      paginationSchema.extend({
        search: z.string().optional(),
        categoryId: z.string().optional(),
        paymentMode: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      request.query,
    );

    const data = await listExpenses(qClient(), storeId, query);
    return data;
  });

  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER, ROLES.CASHIER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const auth = getAuth(request);
      const body = parse(createExpenseSchema, request.body);

      let categoryId = body.categoryId ?? null;
      if (!categoryId && body.categoryName?.trim()) {
        const name = body.categoryName.trim();
        const existing = await listExpenseCategories(qClient(), storeId);
        const match = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (match) {
          categoryId = match.id;
        } else {
          categoryId = (await createExpenseCategory(qClient(), storeId, name)).id;
        }
      }

      const expense = await createExpense(qClient(), storeId, auth.id, {
        ...body,
        categoryId,
      });
      return reply.status(201).send({ expense });
    },
  );

  app.get("/:id", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    const { id } = request.params as { id: string };
    const expense = await getExpenseById(qClient(), storeId, id);
    return { expense };
  });

  app.patch(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(createExpenseSchema.partial(), request.body);
      const expense = await updateExpense(qClient(), storeId, id, body);
      return { expense };
    },
  );

  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const deleted = await deleteExpense(qClient(), storeId, id);
      if (!deleted) throw ApiError.notFound("Expense not found.");
      return reply.send({ ok: true });
    },
  );
}

/**
 * Dedicated router for the `/api/expense-categories` prefix.
 *
 * Mounting the whole `expenseRoutes` plugin there bound its bare `"/"` and
 * `"/:id"` handlers to one-time expenses, so `GET /api/expense-categories`
 * listed expenses and `POST /api/expense-categories` created one instead of a
 * category. Only the category handlers belong here; the web client's
 * `/categories` paths stay supported for compatibility.
 */
export async function expenseCategoryRoutes(app: FastifyInstance) {
  registerCategoryRoutes(app, true);
}

/**
 * Dedicated router for the `/api/recurring-expenses` prefix.
 *
 * The generic `expenseRoutes` plugin is mounted under `/api/expenses`, where its
 * bare `"/"` and `"/:id"` handlers operate on one-time expenses. Mounting that
 * plugin under `/api/recurring-expenses` meant `POST /api/recurring-expenses`
 * hit `createExpense` (Zod stripped `frequency`/`nextDueDate`), and
 * `PATCH`/`DELETE /api/recurring-expenses/:id` acted on one-time rows. This
 * router binds those bare paths to the recurring table so the
 * `/recurring-expenses` contract matches its name.
 */
export async function recurringExpenseRoutes(app: FastifyInstance) {
  // List recurring expenses (also materialises any due items). The collection
  // is exposed both at the resource root and at the legacy `/recurring` path so
  // existing clients keep working.
  const listRecurring = async (request: AuthenticatedRequest) => {
    const storeId = requireStore(request);
    await withTx((tx) => processDueRecurringExpenses(tx, storeId));
    const recurring = await listRecurringExpenses(qClient(), storeId);
    return { recurring };
  };

  app.get("/", { preHandler: authenticate }, listRecurring);
  app.get("/recurring", { preHandler: authenticate }, listRecurring);

  // Create recurring expense
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const auth = getAuth(request);
      const body = parse(createRecurringSchema, request.body);
      const recurring = await createRecurringExpense(qClient(), storeId, auth.id, body);
      return reply.status(201).send({ recurring });
    },
  );

  // Update / toggle active recurring expense
  app.patch(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const body = parse(createRecurringSchema.partial().extend({ isActive: z.boolean().optional() }), request.body);
      const recurring = await updateRecurringExpense(qClient(), storeId, id, body);
      return { recurring };
    },
  );

  // Delete recurring expense
  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const { id } = request.params as { id: string };
      const deleted = await deleteRecurringExpense(qClient(), storeId, id);
      if (!deleted) throw ApiError.notFound("Recurring expense not found.");
      return reply.send({ ok: true });
    },
  );

  // Manually process due items
  app.post(
    "/recurring/process-due",
    { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] },
    async (request: AuthenticatedRequest) => {
      const storeId = requireStore(request);
      const res = await withTx((tx) => processDueRecurringExpenses(tx, storeId));
      return res;
    },
  );
}
