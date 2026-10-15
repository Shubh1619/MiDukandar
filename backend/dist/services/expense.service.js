import { ApiError } from "../lib/api-error.js";
export const DEFAULT_CATEGORIES = ["Rent", "Electricity", "Salary", "Transport", "Misc"];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
/** Ensures default categories exist for the given store */
export async function ensureDefaultCategories(db, storeId) {
    for (const catName of DEFAULT_CATEGORIES) {
        await db.q(`INSERT INTO expense_categories (store_id, name, is_default)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (store_id, name) DO NOTHING`, [storeId, catName]);
    }
}
/** Lists all categories for a store */
export async function listExpenseCategories(db, storeId) {
    await ensureDefaultCategories(db, storeId);
    const rows = await db.q(`SELECT id, store_id, name, is_default, created_at
     FROM expense_categories
     WHERE store_id = $1
     ORDER BY is_default DESC, name ASC`, [storeId]);
    return rows.map((r) => ({
        id: r.id,
        storeId: r.store_id,
        name: r.name,
        isDefault: r.is_default,
        createdAt: r.created_at.toISOString(),
    }));
}
/** Creates a custom expense category */
export async function createExpenseCategory(db, storeId, name) {
    const trimmed = name.trim();
    if (!trimmed) {
        throw ApiError.badRequest("Category name is required.");
    }
    const existing = await db.qOne(`SELECT id FROM expense_categories WHERE store_id = $1 AND lower(name) = lower($2)`, [storeId, trimmed]);
    if (existing) {
        throw ApiError.badRequest(`Category "${trimmed}" already exists.`);
    }
    const r = await db.qOne(`INSERT INTO expense_categories (store_id, name, is_default)
     VALUES ($1, $2, FALSE)
     RETURNING id, store_id, name, is_default, created_at`, [storeId, trimmed]);
    if (!r)
        throw new ApiError(500, "INTERNAL_ERROR", "Failed to create expense category.");
    return {
        id: r.id,
        storeId: r.store_id,
        name: r.name,
        isDefault: r.is_default,
        createdAt: r.created_at.toISOString(),
    };
}
/** Deletes a category. If in use, reassigns existing expenses to default 'Misc' category. */
export async function deleteExpenseCategory(db, storeId, categoryId) {
    const cat = await db.qOne(`SELECT id, name, is_default FROM expense_categories WHERE id = $1 AND store_id = $2`, [categoryId, storeId]);
    if (!cat) {
        throw ApiError.notFound("Category not found.");
    }
    if (cat.is_default) {
        throw ApiError.badRequest("Default categories cannot be deleted.");
    }
    // Ensure default Misc category exists
    await ensureDefaultCategories(db, storeId);
    const miscCat = await db.qOne(`SELECT id FROM expense_categories WHERE store_id = $1 AND name = 'Misc'`, [storeId]);
    let reassignedCount = 0;
    if (miscCat) {
        const updateRes = await db.q(`UPDATE expenses SET category_id = $1 WHERE store_id = $2 AND category_id = $3 RETURNING id`, [miscCat.id, storeId, categoryId]);
        reassignedCount = updateRes.length;
        await db.q(`UPDATE recurring_expenses SET category_id = $1 WHERE store_id = $2 AND category_id = $3`, [miscCat.id, storeId, categoryId]);
    }
    await db.q(`DELETE FROM expense_categories WHERE id = $1 AND store_id = $2`, [categoryId, storeId]);
    return { success: true, reassignedCount };
}
/** List expenses with filters and pagination */
export async function listExpenses(db, storeId, opts = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const offset = (page - 1) * limit;
    const conditions = ["e.store_id = $1"];
    const params = [storeId];
    if (opts.search?.trim()) {
        params.push(`%${opts.search.trim().toLowerCase()}%`);
        conditions.push(`lower(e.title) LIKE $${params.length}`);
    }
    if (opts.categoryId) {
        params.push(opts.categoryId);
        conditions.push(`e.category_id = $${params.length}`);
    }
    if (opts.paymentMode) {
        params.push(opts.paymentMode.toUpperCase());
        conditions.push(`e.payment_mode = $${params.length}`);
    }
    if (opts.from) {
        params.push(opts.from);
        conditions.push(`e.expense_date >= $${params.length}::date`);
    }
    if (opts.to) {
        params.push(opts.to);
        conditions.push(`e.expense_date <= $${params.length}::date`);
    }
    const whereClause = conditions.join(" AND ");
    const countRow = await db.qOne(`SELECT COUNT(*) AS count FROM expenses e WHERE ${whereClause}`, params);
    const total = parseInt(countRow?.count ?? "0", 10);
    const queryParams = [...params, limit, offset];
    const rows = await db.q(`SELECT e.id, e.store_id, e.category_id, c.name AS category_name,
            e.title, e.amount, to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
            e.payment_mode, e.note, e.attachment_url, e.created_by_id,
            e.created_at, e.updated_at
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id
     WHERE ${whereClause}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, queryParams);
    const expenses = rows.map((r) => ({
        id: r.id,
        storeId: r.store_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        title: r.title,
        amount: Number(r.amount),
        expenseDate: r.expense_date,
        paymentMode: r.payment_mode,
        note: r.note,
        attachmentUrl: r.attachment_url,
        createdById: r.created_by_id,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
    }));
    return { expenses, total, page, limit };
}
/** Get single expense by ID */
export async function getExpenseById(db, storeId, id) {
    const r = await db.qOne(`SELECT e.id, e.store_id, e.category_id, c.name AS category_name,
            e.title, e.amount, to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date,
            e.payment_mode, e.note, e.attachment_url, e.created_by_id,
            e.created_at, e.updated_at
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id
     WHERE e.id = $1 AND e.store_id = $2`, [id, storeId]);
    if (!r)
        throw ApiError.notFound("Expense not found.");
    return {
        id: r.id,
        storeId: r.store_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        title: r.title,
        amount: Number(r.amount),
        expenseDate: r.expense_date,
        paymentMode: r.payment_mode,
        note: r.note,
        attachmentUrl: r.attachment_url,
        createdById: r.created_by_id,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
    };
}
/** Create expense record */
export async function createExpense(db, storeId, createdById, data) {
    const title = data.title?.trim();
    if (!title)
        throw ApiError.badRequest("Expense title is required.");
    if (!data.amount || data.amount <= 0)
        throw ApiError.badRequest("Amount must be greater than 0.");
    const expDate = data.expenseDate ? data.expenseDate : new Date().toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    if (expDate > todayStr) {
        throw ApiError.badRequest("Expense date cannot be in the future beyond today.");
    }
    const paymentMode = data.paymentMode ?? "CASH";
    const r = await db.qOne(`INSERT INTO expenses (
       store_id, category_id, title, amount, expense_date, payment_mode, note, attachment_url, created_by_id
     ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
     RETURNING id`, [
        storeId,
        data.categoryId || null,
        title,
        round2(data.amount),
        expDate,
        paymentMode,
        data.note || null,
        data.attachmentUrl || null,
        createdById || null,
    ]);
    if (!r)
        throw new ApiError(500, "INTERNAL_ERROR", "Failed to create expense record.");
    return getExpenseById(db, storeId, r.id);
}
/** Update expense record */
export async function updateExpense(db, storeId, id, data) {
    const existing = await getExpenseById(db, storeId, id);
    let title = existing.title;
    if (data.title !== undefined) {
        title = data.title.trim();
        if (!title)
            throw ApiError.badRequest("Expense title cannot be empty.");
    }
    let amount = existing.amount;
    if (data.amount !== undefined) {
        amount = data.amount;
        if (!amount || amount <= 0)
            throw ApiError.badRequest("Amount must be greater than 0.");
    }
    let expenseDate = existing.expenseDate;
    if (data.expenseDate !== undefined) {
        expenseDate = data.expenseDate;
        const todayStr = new Date().toISOString().split("T")[0];
        if (expenseDate > todayStr) {
            throw ApiError.badRequest("Expense date cannot be in the future beyond today.");
        }
    }
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const paymentMode = data.paymentMode !== undefined ? data.paymentMode : existing.paymentMode;
    const note = data.note !== undefined ? data.note : existing.note;
    const attachmentUrl = data.attachmentUrl !== undefined ? data.attachmentUrl : existing.attachmentUrl;
    await db.q(`UPDATE expenses
     SET title = $1, amount = $2, category_id = $3, expense_date = $4::date,
         payment_mode = $5, note = $6, attachment_url = $7, updated_at = now()
     WHERE id = $8 AND store_id = $9`, [title, round2(amount), categoryId, expenseDate, paymentMode, note, attachmentUrl, id, storeId]);
    return getExpenseById(db, storeId, id);
}
/** Delete expense record */
export async function deleteExpense(db, storeId, id) {
    const r = await db.q(`DELETE FROM expenses WHERE id = $1 AND store_id = $2`, [id, storeId]);
    return true;
}
/** Get expense metrics summary (Today, Month, vs Last Month, Top Category, Breakdown) */
export async function getExpenseSummary(db, storeId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startThisMonth = new Date(year, month, 1).toISOString().split("T")[0];
    const endThisMonth = new Date(year, month + 1, 0).toISOString().split("T")[0];
    const startLastMonth = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const endLastMonth = new Date(year, month, 0).toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];
    const [todayAgg, thisMonthAgg, lastMonthAgg] = await Promise.all([
        db.qOne(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE store_id = $1 AND expense_date = $2::date`, [storeId, todayStr]),
        db.qOne(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE store_id = $1 AND expense_date BETWEEN $2::date AND $3::date`, [storeId, startThisMonth, endThisMonth]),
        db.qOne(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE store_id = $1 AND expense_date BETWEEN $2::date AND $3::date`, [storeId, startLastMonth, endLastMonth]),
    ]);
    const todayTotal = round2(parseFloat(todayAgg?.total ?? "0"));
    const thisMonthTotal = round2(parseFloat(thisMonthAgg?.total ?? "0"));
    const lastMonthTotal = round2(parseFloat(lastMonthAgg?.total ?? "0"));
    let pctChangeVsLastMonth = 0;
    if (lastMonthTotal > 0) {
        pctChangeVsLastMonth = round2(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
    }
    else if (thisMonthTotal > 0) {
        pctChangeVsLastMonth = 100;
    }
    const categoryRows = await db.q(`SELECT e.category_id, COALESCE(c.name, 'Uncategorized') AS category_name, SUM(e.amount) AS total
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id = e.category_id
     WHERE e.store_id = $1 AND e.expense_date BETWEEN $2::date AND $3::date
     GROUP BY e.category_id, c.name
     ORDER BY SUM(e.amount) DESC`, [storeId, startThisMonth, endThisMonth]);
    const categoryBreakdown = categoryRows.map((r) => {
        const tot = round2(parseFloat(r.total));
        const pct = thisMonthTotal > 0 ? round2((tot / thisMonthTotal) * 100) : 0;
        return {
            categoryId: r.category_id,
            categoryName: r.category_name ?? "Uncategorized",
            total: tot,
            percentage: pct,
        };
    });
    const topCategory = categoryBreakdown.length > 0
        ? { name: categoryBreakdown[0].categoryName, total: categoryBreakdown[0].total }
        : null;
    return {
        todayTotal,
        thisMonthTotal,
        lastMonthTotal,
        pctChangeVsLastMonth,
        topCategory,
        categoryBreakdown,
    };
}
/** Recurring Expenses Services */
export async function listRecurringExpenses(db, storeId) {
    const rows = await db.q(`SELECT r.id, r.store_id, r.category_id, c.name AS category_name,
            r.title, r.amount, r.frequency, to_char(r.next_due_date, 'YYYY-MM-DD') AS next_due_date,
            r.payment_mode, r.is_active, r.created_by_id, r.created_at, r.updated_at
     FROM recurring_expenses r
     LEFT JOIN expense_categories c ON c.id = r.category_id
     WHERE r.store_id = $1
     ORDER BY r.is_active DESC, r.next_due_date ASC`, [storeId]);
    return rows.map((r) => ({
        id: r.id,
        storeId: r.store_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        title: r.title,
        amount: Number(r.amount),
        frequency: r.frequency,
        nextDueDate: r.next_due_date,
        paymentMode: r.payment_mode,
        isActive: r.is_active,
        createdById: r.created_by_id,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
    }));
}
export async function createRecurringExpense(db, storeId, createdById, data) {
    const title = data.title?.trim();
    if (!title)
        throw ApiError.badRequest("Title is required.");
    if (!data.amount || data.amount <= 0)
        throw ApiError.badRequest("Amount must be greater than 0.");
    if (!data.nextDueDate)
        throw ApiError.badRequest("Next due date is required.");
    const r = await db.qOne(`INSERT INTO recurring_expenses (
       store_id, category_id, title, amount, frequency, next_due_date, payment_mode, is_active, created_by_id
     ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, TRUE, $8)
     RETURNING id`, [
        storeId,
        data.categoryId || null,
        title,
        round2(data.amount),
        data.frequency || "MONTHLY",
        data.nextDueDate,
        data.paymentMode || "CASH",
        createdById || null,
    ]);
    if (!r)
        throw new ApiError(500, "INTERNAL_ERROR", "Failed to create recurring expense.");
    const list = await listRecurringExpenses(db, storeId);
    return list.find((item) => item.id === r.id);
}
export async function updateRecurringExpense(db, storeId, id, data) {
    const list = await listRecurringExpenses(db, storeId);
    const existing = list.find((item) => item.id === id);
    if (!existing)
        throw ApiError.notFound("Recurring expense not found.");
    let title = existing.title;
    if (data.title !== undefined) {
        title = data.title.trim();
        if (!title)
            throw ApiError.badRequest("Title cannot be empty.");
    }
    let amount = existing.amount;
    if (data.amount !== undefined) {
        amount = data.amount;
        if (!amount || amount <= 0)
            throw ApiError.badRequest("Amount must be greater than 0.");
    }
    const categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
    const frequency = data.frequency !== undefined ? data.frequency : existing.frequency;
    const nextDueDate = data.nextDueDate !== undefined ? data.nextDueDate : existing.nextDueDate;
    const paymentMode = data.paymentMode !== undefined ? data.paymentMode : existing.paymentMode;
    const isActive = data.isActive !== undefined ? data.isActive : existing.isActive;
    await db.q(`UPDATE recurring_expenses
     SET title = $1, amount = $2, category_id = $3, frequency = $4,
         next_due_date = $5::date, payment_mode = $6, is_active = $7, updated_at = now()
     WHERE id = $8 AND store_id = $9`, [title, round2(amount), categoryId, frequency, nextDueDate, paymentMode, isActive, id, storeId]);
    const updatedList = await listRecurringExpenses(db, storeId);
    return updatedList.find((item) => item.id === id);
}
export async function deleteRecurringExpense(db, storeId, id) {
    await db.q(`DELETE FROM recurring_expenses WHERE id = $1 AND store_id = $2`, [id, storeId]);
    return true;
}
/** Auto-process due recurring expenses and create actual expense entries */
export async function processDueRecurringExpenses(db, storeId) {
    const todayStr = new Date().toISOString().split("T")[0];
    const params = [todayStr];
    let storeFilter = "";
    if (storeId) {
        params.push(storeId);
        storeFilter = ` AND store_id = $2`;
    }
    const dueRows = await db.q(`SELECT id, store_id, category_id, title, amount, frequency,
            to_char(next_due_date, 'YYYY-MM-DD') AS next_due_date,
            payment_mode, created_by_id
     FROM recurring_expenses
     WHERE is_active = TRUE AND next_due_date <= $1::date${storeFilter}`, params);
    let createdCount = 0;
    for (const row of dueRows) {
        // 1. Create real expense entry for the due date
        await createExpense(db, row.store_id, row.created_by_id || undefined, {
            title: row.title,
            amount: Number(row.amount),
            categoryId: row.category_id,
            expenseDate: row.next_due_date,
            paymentMode: row.payment_mode,
            note: `Auto-generated from recurring expense: ${row.frequency}`,
        });
        createdCount++;
        // 2. Compute next due date
        const currentDate = new Date(row.next_due_date);
        if (row.frequency === "WEEKLY") {
            currentDate.setDate(currentDate.getDate() + 7);
        }
        else {
            // MONTHLY
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        const newNextDue = currentDate.toISOString().split("T")[0];
        // 3. Update next_due_date in recurring_expenses
        await db.q(`UPDATE recurring_expenses SET next_due_date = $1::date, updated_at = now() WHERE id = $2`, [newNextDue, row.id]);
    }
    return { createdCount };
}
