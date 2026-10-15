/**
 * Records a payment row. Covers every flow in the app: customer receipts,
 * supplier payouts and sale checkouts (which also link a sale_id).
 */
export async function insertPayment(db, input) {
    const row = await db.qOne(`INSERT INTO payments (store_id, customer_id, sale_id, amount, type, mode, reference_type, reference_id, note, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`, [
        input.storeId,
        input.customerId ?? null,
        input.saleId ?? null,
        input.amount,
        input.type,
        input.mode,
        input.referenceType,
        input.referenceId,
        input.note ?? null,
        input.createdById,
    ]);
    if (!row)
        throw new Error("Payment insert failed");
    return row;
}
