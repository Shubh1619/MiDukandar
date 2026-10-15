import { ApiError } from "../lib/api-error.js";
/**
 * The ledger balance expression: SUM(DEBIT) - SUM(CREDIT). Pass an optional
 * table alias to qualify the columns inside a JOIN/subquery.
 */
export function ledgerBalanceExpr(alias = "") {
    const p = alias ? `${alias}.` : "";
    return `SUM(CASE WHEN ${p}type='DEBIT' THEN ${p}amount ELSE -${p}amount END)`;
}
/**
 * Computes a customer's outstanding (udhaari) balance:
 * SUM(DEBIT) - SUM(CREDIT) over the immutable ledger.
 */
export async function getCustomerOutstanding(db, customerId) {
    const row = await db.qOne(`SELECT COALESCE(${ledgerBalanceExpr()}, 0) AS sum
     FROM ledger_entries WHERE customer_id = $1`, [customerId]);
    return row?.sum ?? 0;
}
/**
 * Appends a ledger entry and returns the balance AFTER it. Must run inside a
 * transaction. `amount` is always positive; `type` encodes direction.
 */
export async function createLedgerEntry(db, input) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw ApiError.badRequestCode("Ledger amount must be positive.", "INVALID_AMOUNT");
    }
    const row = await db.qOne(`SELECT COALESCE(${ledgerBalanceExpr()}, 0) AS sum
     FROM ledger_entries WHERE customer_id = $1`, [input.customerId]);
    const balanceBefore = row?.sum ?? 0;
    const balanceAfter = balanceBefore + (input.type === "DEBIT" ? input.amount : -input.amount);
    let storeId = input.storeId;
    if (!storeId) {
        const c = await db.qOne(`SELECT store_id FROM customers WHERE id = $1`, [
            input.customerId,
        ]);
        storeId = c?.store_id;
    }
    await db.q(`INSERT INTO ledger_entries (customer_id, store_id, type, amount, balance_after, reference_type, reference_id, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        input.customerId,
        storeId,
        input.type,
        input.amount,
        balanceAfter,
        input.referenceType,
        input.referenceId ?? null,
        input.note ?? null,
    ]);
    return balanceAfter;
}
export async function setupCustomerOpeningBalance(db, customerId, storeId, openingBalance) {
    if (!openingBalance)
        return;
    const existing = await db.qOne(`SELECT COUNT(*) AS c FROM ledger_entries WHERE customer_id = $1 AND reference_type = 'OPENING'`, [customerId]);
    if ((existing?.c ?? 0) > 0)
        return;
    await createLedgerEntry(db, {
        customerId,
        storeId,
        type: "DEBIT",
        amount: Math.abs(openingBalance),
        referenceType: "OPENING",
        note: "Opening balance carried forward",
    });
}
