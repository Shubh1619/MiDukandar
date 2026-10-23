import { ApiError } from "../lib/api-error.js";
import { dec, dmax, dmin, money, moneyNum, qty as roundQty3, sumMoney } from "../lib/money.js";
import { getStockBalances, createStockMovement } from "./stock.service.js";
import { createLedgerEntry } from "./ledger.service.js";
import { insertPayment } from "./payment.service.js";
const round2 = (n) => moneyNum(n);
/** Normalizes a `date` column (pg returns a local Date) to `YYYY-MM-DD`. */
function toYmd(v) {
    if (!v)
        return undefined;
    if (v instanceof Date) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    }
    return String(v).slice(0, 10);
}
/** Prices line items and returns computed line rows plus running subtotal/tax/line-discounts. */
function priceLines(lines, pMap) {
    let subtotal = dec(0);
    let taxTotal = dec(0);
    const items = lines.map((line) => {
        const p = line.productId ? pMap.get(line.productId) : undefined;
        const unitPrice = money(line.unitPrice ?? p?.selling_price ?? 0);
        const lineQty = dec(roundQty3(line.qty));
        const baseAmount = unitPrice.times(lineQty);
        const lineDisc = money(line.discount ?? 0);
        const gstPercent = money(line.gstPercent ?? p?.gst_percent ?? 0);
        const taxable = baseAmount.minus(lineDisc);
        const taxAmount = money(gstPercent.gt(0) ? taxable.times(gstPercent).div(100) : 0);
        const lineTotal = money(taxable.plus(taxAmount));
        subtotal = subtotal.plus(baseAmount);
        taxTotal = taxTotal.plus(taxAmount);
        return {
            productId: p?.id ?? null,
            productName: line.productName?.trim() || p?.name || "Item",
            barcode: p?.barcode ?? null,
            qty: lineQty.toNumber(),
            unitPrice: unitPrice.toNumber(),
            discount: lineDisc.toNumber(),
            gstPercent: gstPercent.toNumber(),
            taxAmount: taxAmount.toNumber(),
            lineTotal: lineTotal.toNumber(),
        };
    });
    const lineDiscounts = money(sumMoney(items.map((it) => it.discount)));
    return {
        items,
        subtotal: moneyNum(subtotal),
        taxTotal: moneyNum(taxTotal),
        lineDiscounts: lineDiscounts.toNumber(),
    };
}
/** Applies a bill-level discount and returns the grand total before payment split. */
function billTotals(subtotal, taxTotal, lineDiscounts, discount, discountType) {
    let billDiscount = money(discount ?? 0);
    if (discountType === "PERCENT") {
        billDiscount = money(dec(subtotal).times(billDiscount).div(100));
    }
    const grantTotal = money(dec(subtotal).plus(taxTotal).minus(money(dec(lineDiscounts).plus(billDiscount))));
    return { billDiscount: billDiscount.toNumber(), grantTotal: grantTotal.toNumber() };
}
/** Splits the grand total into paid/due based on payment mode. CREDIT is the only mode that leaves a balance. */
function splitPayment(grantTotal, paymentMode, paidAmount) {
    const total = dec(grantTotal);
    const payable = paymentMode === "CREDIT" ? dec(paidAmount ?? 0) : dec(paidAmount ?? total);
    const paid = money(dmin(total, dmax(0, payable)));
    const due = paymentMode === "CREDIT" ? money(total.minus(paid)) : dec(0);
    return { paidAmount: paid.toNumber(), dueAmount: due.toNumber() };
}
async function getNextNumber(db, storeId, type) {
    const row = await db.qOne(`UPDATE stores SET invoice_sequence = invoice_sequence + 1, updated_at = now()
     WHERE id = $1 RETURNING id, invoice_sequence, invoice_prefix`, [storeId]);
    if (!row)
        throw ApiError.notFound("Store not found");
    const seq = row.invoice_sequence;
    const prefix = type === "PUR" ? "PUR" : row.invoice_prefix;
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `${prefix}-${ymd}-${String(seq).padStart(4, "0")}`;
}
/**
 * Resolves the sale's customer: an explicit `customerId` wins, otherwise a
 * free-entry `customer` object is auto-created as a new master record.
 * Returns `undefined` for anonymous walk-ins. Must run inside a transaction.
 */
async function resolveCustomer(db, storeId, input, createdById) {
    if (input.customerId)
        return input.customerId;
    const c = input.customer;
    if (!c || !c.name || !c.name.trim())
        return undefined;
    const row = await db.qOne(`INSERT INTO customers (store_id, name, mobile, address, city, state, pincode, gst)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`, [
        storeId,
        c.name.trim(),
        c.mobile?.trim() || null,
        c.address?.trim() || null,
        c.city?.trim() || null,
        c.state?.trim() || null,
        c.pincode?.trim() || null,
        c.gst?.trim() || null,
    ]);
    if (!row)
        throw new Error("Customer insert failed");
    return row.id;
}
/** Inserts a udhaari entry linked to an invoice, mirroring the credit ledger DEBIT. */
async function linkUdhaariEntry(db, storeId, customerId, sale, amount, udhaar, createdById) {
    await db.q(`INSERT INTO udhaari_entries (store_id, customer_id, sale_id, amount, entry_date, due_date, reminder_date, note, created_by_id)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8)`, [
        storeId,
        customerId,
        sale.id,
        amount,
        udhaar?.dueDate || null,
        udhaar?.reminderDate || null,
        `Invoice ${sale.invoice_number}`,
        createdById,
    ]);
}
/**
 * Settles the udhaari entries linked to a sale, allocating up to `amount`
 * across the outstanding entries (FIFO). Each covered entry gets a udhaari
 * payment plus the matching ledger CREDIT and payments row so all three
 * surfaces stay in sync. Returns the total amount allocated to linked entries.
 */
async function settleLinkedUdhaari(db, storeId, sale, amount, mode, userId) {
    const linked = await db.q(`SELECT e.id, e.amount,
            (SELECT COALESCE(SUM(p.amount), 0) FROM udhaari_payments p WHERE p.udhaari_entry_id = e.id) AS paid
     FROM udhaari_entries e WHERE e.sale_id = $1`, [sale.id]);
    const outstanding = linked.filter((e) => dec(e.amount).minus(e.paid ?? 0).gt(0));
    if (outstanding.length === 0)
        return 0;
    let remaining = money(amount);
    let allocated = dec(0);
    for (const entry of outstanding) {
        if (remaining.lte(0))
            break;
        const entryOutstanding = money(dec(entry.amount).minus(entry.paid ?? 0));
        const paymentAmount = money(dmin(entryOutstanding, remaining));
        const payment = await db.qOne(`INSERT INTO udhaari_payments (store_id, udhaari_entry_id, amount, mode, note, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`, [storeId, entry.id, paymentAmount.toNumber(), mode, `Payment for ${sale.invoice_number}`, userId]);
        if (!payment)
            throw new Error("Udhaari payment insert failed");
        if (sale.customer_id) {
            await createLedgerEntry(db, {
                customerId: sale.customer_id,
                storeId,
                type: "CREDIT",
                amount: paymentAmount.toNumber(),
                referenceType: "UDHAARI_PAYMENT",
                referenceId: payment.id,
                note: `Payment for ${sale.invoice_number}`,
            });
        }
        await insertPayment(db, {
            storeId,
            customerId: sale.customer_id ?? null,
            amount: paymentAmount.toNumber(),
            type: "RECEIVED",
            mode,
            referenceType: "UDHAARI_PAYMENT",
            referenceId: payment.id,
            note: `Payment for ${sale.invoice_number}`,
            createdById: userId,
        });
        allocated = allocated.plus(paymentAmount);
        remaining = remaining.minus(paymentAmount);
    }
    return moneyNum(allocated);
}
/**
 * Creates a sale atomically:
 *  - validates stock availability (against derived balances)
 *  - inserts sale + line items
 *  - appends negative stock movements for each line
 *  - opens a ledger DEBIT for CREDIT mode
 *  - records the payment for CASH/UPI/CARD modes
 * Throws on any step → the whole transaction rolls back.
 */
export async function createSale(db, input) {
    if (input.lines.length === 0) {
        throw ApiError.badRequestCode("Sale must have at least one line item.", "EMPTY_SALE");
    }
    const invoiceNumber = await getNextNumber(db, input.storeId, "INV");
    const customerId = await resolveCustomer(db, input.storeId, input, input.createdById);
    const catalogLines = input.lines.filter((l) => l.productId);
    const productIds = [...new Set(catalogLines.map((l) => l.productId))];
    const products = productIds.length > 0
        ? await db.q(`SELECT id, name, barcode, selling_price, gst_percent, store_id FROM products WHERE id = ANY($1::uuid[])`, [productIds])
        : [];
    if (products.length !== productIds.length) {
        throw ApiError.badRequestCode("One or more products are invalid or belong to another store.", "INVALID_PRODUCT");
    }
    for (const p of products) {
        if (p.store_id !== input.storeId) {
            throw ApiError.badRequestCode("One or more products belong to another store.", "INVALID_PRODUCT");
        }
    }
    const pMap = new Map(products.map((p) => [p.id, p]));
    // Stock check against derived balances.
    await assertStock(db, input.lines, pMap);
    const { items, subtotal, taxTotal, lineDiscounts } = priceLines(input.lines, pMap);
    const { billDiscount, grantTotal } = billTotals(subtotal, taxTotal, lineDiscounts, input.discount, input.discountType);
    const { paidAmount, dueAmount } = splitPayment(grantTotal, input.paymentMode, input.paidAmount);
    const now = new Date();
    const dueDate = input.paymentMode === "CREDIT" ? input.udhaar?.dueDate || null : null;
    const sale = await db.qOne(`INSERT INTO sales
       (store_id, invoice_number, customer_id, subtotal, discount, discount_type, tax_total, total, paid_amount, due_amount, payment_mode, due_date, status, notes, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CONFIRMED', $13, $14, $15, $15)
     RETURNING id, invoice_number, subtotal, discount, tax_total, total, paid_amount, due_amount, payment_mode, due_date, status, customer_id, created_at`, [
        input.storeId,
        invoiceNumber,
        customerId ?? null,
        subtotal,
        billDiscount,
        input.discountType ?? "FLAT",
        taxTotal,
        grantTotal,
        paidAmount,
        dueAmount,
        input.paymentMode,
        dueDate,
        input.notes ?? null,
        input.createdById,
        now,
    ]);
    if (!sale)
        throw new Error("Sale insert failed");
    for (const it of items) {
        await db.q(`INSERT INTO sale_items (sale_id, product_id, product_name, barcode, qty, unit_price, discount, gst_percent, tax_amount, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [sale.id, it.productId, it.productName, it.barcode, it.qty, it.unitPrice, it.discount, it.gstPercent, it.taxAmount, it.lineTotal]);
        if (!it.productId)
            continue;
        await createStockMovement(db, {
            productId: it.productId,
            storeId: input.storeId,
            qty: -it.qty,
            type: "SALE",
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Sale ${invoiceNumber}`,
            createdById: input.createdById,
        });
    }
    // Credit ledger + linked udhaari entry (so the Udhaari section tracks the invoice)
    if (input.paymentMode === "CREDIT" && customerId && dueAmount > 0) {
        await createLedgerEntry(db, {
            customerId,
            storeId: input.storeId,
            type: "DEBIT",
            amount: dueAmount,
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Credit sale ${invoiceNumber}`,
        });
        await linkUdhaariEntry(db, input.storeId, customerId, sale, dueAmount, input.udhaar, input.createdById);
    }
    // Payment record (CASH/UPI/CARD)
    if (input.paymentMode !== "CREDIT" && paidAmount > 0) {
        await insertPayment(db, {
            storeId: input.storeId,
            customerId: customerId ?? null,
            saleId: sale.id,
            amount: paidAmount,
            type: "RECEIVED",
            mode: input.paymentMode,
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Payment for ${invoiceNumber}`,
            createdById: input.createdById,
        });
    }
    return sale;
}
/**
 * Validates that every catalog product on the invoice has enough stock.
 *
 * Quantities are AGGREGATED per product before comparing against the balance.
 * A per-line check is not equivalent: an invoice with two lines for the same
 * product (qty 6 and qty 6) would pass a per-line check against a balance of
 * 10, then write 12 units of stock movement and leave the store oversold.
 *
 * Balances are derived by summing the movement ledger rather than read from a
 * counter column, so the check and the subsequent writes are separated by no
 * lock at all. Taking a row lock on the products themselves serialises any
 * concurrent sale touching the same items, which closes that window.
 */
async function assertStock(db, lines, pMap) {
    const catalogLines = lines.filter((l) => l.productId);
    if (catalogLines.length === 0)
        return;
    const required = new Map();
    for (const line of catalogLines) {
        const productId = line.productId;
        required.set(productId, (required.get(productId) ?? 0) + line.qty);
    }
    const productIds = [...required.keys()];
    // Serialise concurrent sales that touch the same products (pattern already
    // used for stores in product.routes.ts). Without this, two cashiers can both
    // validate the same last unit and both commit.
    await db.q(`SELECT id FROM products WHERE id = ANY($1::uuid[]) FOR UPDATE`, [productIds]);
    const balances = await getStockBalances(db, productIds);
    for (const [productId, needQty] of required) {
        const p = pMap.get(productId);
        const available = dec(balances[productId] ?? 0);
        if (available.lt(dec(needQty))) {
            throw ApiError.conflict(`Insufficient stock for "${p?.name ?? "item"}" - available ${available.toNumber()}.`);
        }
    }
}
/**
 * Creates a purchase atomically: inserts purchase + items, then positive
 * stock movements for every line.
 */
export async function createPurchase(db, input) {
    if (input.lines.length === 0) {
        throw ApiError.badRequestCode("Purchase must have at least one line item.", "EMPTY_PURCHASE");
    }
    const purchaseNumber = await getNextNumber(db, input.storeId, "PUR");
    const catalogLines = input.lines.filter((l) => l.productId);
    const productIds = [...new Set(catalogLines.map((l) => l.productId))];
    const products = productIds.length > 0
        ? await db.q(
        // Scoped to the purchasing store. Previously this selected by id alone
        // with no store filter and no ownership assertion, so a caller could
        // pass another tenant's product id and have a PURCHASE stock movement
        // written against it under their own store_id — corrupting the other
        // store's derived balance. createSale already asserted ownership; this
        // path did not.
        `SELECT id, name, barcode, purchase_price, gst_percent, store_id
           FROM products WHERE id = ANY($1::uuid[]) AND store_id = $2`, [productIds, input.storeId])
        : [];
    if (products.length !== productIds.length) {
        throw ApiError.badRequestCode("One or more products are invalid or belong to another store.", "INVALID_PRODUCT");
    }
    for (const p of products) {
        if (p.store_id !== input.storeId) {
            throw ApiError.badRequestCode("One or more products belong to another store.", "INVALID_PRODUCT");
        }
    }
    const pMap = new Map(products.map((p) => [p.id, p]));
    let subtotal = dec(0);
    let taxTotal = dec(0);
    const items = input.lines.map((line) => {
        const p = line.productId ? pMap.get(line.productId) : undefined;
        const unitPrice = money(line.unitPrice ?? p?.purchase_price ?? 0);
        const lineQty = dec(roundQty3(line.qty));
        const baseAmount = unitPrice.times(lineQty);
        const gstPercent = money(line.gstPercent ?? p?.gst_percent ?? 0);
        const taxAmount = money(baseAmount.times(gstPercent).div(100));
        subtotal = subtotal.plus(baseAmount);
        taxTotal = taxTotal.plus(taxAmount);
        return {
            productId: p?.id ?? null,
            productName: line.productName?.trim() || p?.name || "Item",
            barcode: p?.barcode ?? null,
            qty: lineQty.toNumber(),
            unitPrice: unitPrice.toNumber(),
            gstPercent: gstPercent.toNumber(),
            taxAmount: taxAmount.toNumber(),
            lineTotal: money(baseAmount.plus(taxAmount)).toNumber(),
        };
    });
    const subtotalNum = moneyNum(subtotal);
    const taxTotalNum = moneyNum(taxTotal);
    const discount = money(input.discount ?? 0);
    const grantTotal = money(dec(subtotalNum).minus(discount).plus(taxTotalNum));
    const paidAmount = money(dmin(grantTotal, input.paidAmount ?? grantTotal));
    const dueAmount = money(grantTotal.minus(paidAmount));
    const paymentStatus = dueAmount.lte(0) ? "PAID" : paidAmount.gt(0) ? "PARTIAL" : "UNPAID";
    const now = new Date();
    const purchase = await db.qOne(`INSERT INTO purchases
       (store_id, purchase_number, supplier_name, supplier_mobile, subtotal, discount, tax_total, total, paid_amount, due_amount, payment_status, notes, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
     RETURNING id, purchase_number, subtotal, discount, tax_total, total, paid_amount, due_amount, payment_status, created_at`, [
        input.storeId,
        purchaseNumber,
        input.supplierName,
        input.supplierMobile ?? null,
        subtotalNum,
        discount.toNumber(),
        taxTotalNum,
        grantTotal.toNumber(),
        paidAmount.toNumber(),
        dueAmount.toNumber(),
        paymentStatus,
        input.notes ?? null,
        input.createdById,
        now,
    ]);
    if (!purchase)
        throw new Error("Purchase insert failed");
    for (const it of items) {
        await db.q(`INSERT INTO purchase_items (purchase_id, product_id, product_name, barcode, qty, unit_price, gst_percent, tax_amount, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [purchase.id, it.productId, it.productName, it.barcode, it.qty, it.unitPrice, it.gstPercent, it.taxAmount, it.lineTotal]);
        if (!it.productId)
            continue;
        await createStockMovement(db, {
            productId: it.productId,
            storeId: input.storeId,
            qty: it.qty,
            type: "PURCHASE",
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            note: `Purchase ${purchaseNumber}`,
            createdById: input.createdById,
        });
    }
    return purchase;
}
/**
 * Reversal of a confirmed sale - the ONLY allowed mutation of a financial
 * record. Reverses stock and credit ledger by appending offsetting entries.
 */
export async function reverseSale(db, storeId, saleId, reason, userId) {
    // FOR UPDATE: reversal is the only mutation a financial record accepts, and it
    // is gated on `status = 'CONFIRMED'`. Without the lock, two concurrent
    // reversals both read CONFIRMED and both append restock movements for every
    // line, crediting the store with double the returned stock.
    const sale = await db.qOne(`SELECT * FROM sales WHERE id = $1 AND store_id = $2 FOR UPDATE`, [saleId, storeId]);
    if (!sale)
        throw ApiError.notFound("Sale not found");
    if (sale.status !== "CONFIRMED") {
        throw ApiError.conflict("Only confirmed sales can be reversed.");
    }
    const items = await db.q(`SELECT product_id, qty FROM sale_items WHERE sale_id = $1`, [saleId]);
    for (const it of items) {
        if (!it.product_id)
            continue;
        await createStockMovement(db, {
            productId: it.product_id,
            storeId,
            qty: Math.abs(it.qty),
            type: "REVERSAL",
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Reversal: ${sale.invoice_number} (${reason})`,
            createdById: userId,
        });
    }
    if (sale.payment_mode === "CREDIT" && sale.customer_id && sale.due_amount > 0) {
        await createLedgerEntry(db, {
            customerId: sale.customer_id,
            storeId,
            type: "CREDIT",
            amount: sale.due_amount,
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Reversal of credit sale ${sale.invoice_number}`,
        });
    }
    // Remove the invoice's linked udhaari entries (their payments cascade off;
    // ledger + payments history is append-only and stays for the audit trail).
    if (sale.payment_mode === "CREDIT") {
        await db.q(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [saleId]);
    }
    await db.q(`UPDATE sales SET status = 'REVERSED', reversed_by_id = $1, reversed_at = now(), updated_at = now() WHERE id = $2`, [userId, saleId]);
    return sale;
}
/**
 * Edits a confirmed sale: restocks the previous lines, replaces the line items,
 * re-prices everything and reconciles the credit ledger + payment record with
 * offsetting entries (the ledger is append-only, so nothing is deleted).
 * The invoice number is preserved.
 */
export async function updateSale(db, storeId, saleId, input) {
    // FOR UPDATE: the edit restocks the previous lines, deletes them and re-prices
    // from scratch, all gated on this row still being CONFIRMED. Locking it stops
    // a concurrent edit or reversal from interleaving and double-restocking.
    const existing = await db.qOne(`SELECT * FROM sales WHERE id = $1 AND store_id = $2 FOR UPDATE`, [saleId, storeId]);
    if (!existing)
        throw ApiError.notFound("Sale not found");
    if (existing.status !== "CONFIRMED") {
        throw ApiError.conflict("Only confirmed sales can be edited.");
    }
    // Restock the previous lines before replacing them.
    const oldItems = await db.q(`SELECT product_id, product_name, qty, unit_price, discount, gst_percent FROM sale_items WHERE sale_id = $1`, [saleId]);
    // A partial edit omits `lines`: reuse the stored lines (and the bill discount
    // and credit due date) so callers can change just customer/paid/mode/notes.
    const partial = input.lines === undefined;
    const lines = partial
        ? oldItems.map((it) => ({
            productId: it.product_id,
            productName: it.product_name,
            qty: Number(it.qty),
            unitPrice: Number(it.unit_price),
            discount: Number(it.discount),
            gstPercent: Number(it.gst_percent),
        }))
        : input.lines ?? [];
    if (lines.length === 0) {
        throw ApiError.badRequestCode("Sale must have at least one line item.", "EMPTY_SALE");
    }
    const discount = partial ? Number(existing.discount) : input.discount;
    const discountType = partial ? existing.discount_type : input.discountType;
    const udhaar = partial
        ? { dueDate: toYmd(existing.due_date) }
        : input.udhaar;
    // An omitted field means "unchanged" (the same convention `lines`, `discount`
    // and `udhaar` already follow). Writing `input.x ?? null` instead would clear
    // the customer link, wipe the notes and, with `input.paidAmount ?? 0`/the
    // mode changing, reset the settlement of an invoice the caller only meant to
    // partially touch. Payment history is only rebuilt when its inputs change.
    const touchesPayment = input.paymentMode !== undefined || input.paidAmount !== undefined;
    const paymentMode = input.paymentMode ?? existing.payment_mode;
    const preservedPaid = existing.due_amount <= 0 || existing.payment_mode === "CREDIT"
        ? Number(existing.paid_amount)
        : undefined;
    for (const it of oldItems) {
        if (!it.product_id)
            continue;
        await createStockMovement(db, {
            productId: it.product_id,
            storeId,
            qty: Math.abs(it.qty),
            type: "ADJUSTMENT",
            referenceType: "SALE",
            referenceId: saleId,
            note: `Edit ${existing.invoice_number} (restock)`,
            createdById: input.createdById,
        });
    }
    await db.q(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId]);
    const catalogLines = lines.filter((l) => l.productId);
    const productIds = [...new Set(catalogLines.map((l) => l.productId))];
    const products = productIds.length > 0
        ? await db.q(`SELECT id, name, barcode, selling_price, gst_percent, store_id FROM products WHERE id = ANY($1::uuid[])`, [productIds])
        : [];
    if (products.length !== productIds.length) {
        throw ApiError.badRequestCode("One or more products are invalid.", "INVALID_PRODUCT");
    }
    for (const p of products) {
        if (p.store_id !== storeId) {
            throw ApiError.badRequestCode("One or more products belong to another store.", "INVALID_PRODUCT");
        }
    }
    const pMap = new Map(products.map((p) => [p.id, p]));
    await assertStock(db, lines, pMap);
    const { items, subtotal, taxTotal, lineDiscounts } = priceLines(lines, pMap);
    const { billDiscount, grantTotal } = billTotals(subtotal, taxTotal, lineDiscounts, discount, discountType);
    const { paidAmount, dueAmount } = splitPayment(grantTotal, paymentMode, input.paidAmount ?? preservedPaid);
    const customerId = input.customerId !== undefined || input.customer !== undefined
        ? await resolveCustomer(db, storeId, input, input.createdById)
        : (existing.customer_id ?? undefined);
    const updated = await db.qOne(`UPDATE sales
        SET customer_id = $1, subtotal = $2, discount = $3, discount_type = $4, tax_total = $5,
            total = $6, paid_amount = $7, due_amount = $8, payment_mode = $9, due_date = $10, notes = $11,
            status = 'CONFIRMED', updated_at = now()
      WHERE id = $12 AND store_id = $13
      RETURNING id, invoice_number, subtotal, discount, tax_total, total, paid_amount, due_amount, payment_mode, due_date, status, customer_id, created_at`, [
        customerId ?? null,
        subtotal,
        billDiscount,
        discountType ?? "FLAT",
        taxTotal,
        grantTotal,
        paidAmount,
        dueAmount,
        paymentMode,
        udhaar?.dueDate || null,
        input.notes !== undefined ? input.notes : existing.notes,
        saleId,
        storeId,
    ]);
    if (!updated)
        throw new Error("Sale update failed");
    for (const it of items) {
        await db.q(`INSERT INTO sale_items (sale_id, product_id, product_name, barcode, qty, unit_price, discount, gst_percent, tax_amount, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [saleId, it.productId, it.productName, it.barcode, it.qty, it.unitPrice, it.discount, it.gstPercent, it.taxAmount, it.lineTotal]);
        if (!it.productId)
            continue;
        await createStockMovement(db, {
            productId: it.productId,
            storeId,
            qty: -it.qty,
            type: "ADJUSTMENT",
            referenceType: "SALE",
            referenceId: saleId,
            note: `Edit ${existing.invoice_number}`,
            createdById: input.createdById,
        });
    }
    // Reconcile ledger (append-only): reverse the old credit, then book the new one.
    // Re-point the linked udhaari entry to the new credit amount (or drop it when
    // the invoice is no longer a credit sale).
    await db.q(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [saleId]);
    if (existing.payment_mode === "CREDIT" && existing.customer_id && existing.due_amount > 0) {
        await createLedgerEntry(db, {
            customerId: existing.customer_id,
            storeId,
            type: "CREDIT",
            amount: existing.due_amount,
            referenceType: "SALE",
            referenceId: saleId,
            note: `Edit ${existing.invoice_number} (revert old credit)`,
        });
    }
    if (input.paymentMode === "CREDIT" && customerId && dueAmount > 0) {
        await createLedgerEntry(db, {
            customerId,
            storeId,
            type: "DEBIT",
            amount: dueAmount,
            referenceType: "SALE",
            referenceId: saleId,
            note: `Credit sale ${existing.invoice_number}`,
        });
        await linkUdhaariEntry(db, storeId, customerId, existing, dueAmount, udhaar, input.createdById);
    }
    if (touchesPayment) {
        await db.q(`DELETE FROM payments WHERE sale_id = $1`, [saleId]);
        if (paymentMode !== "CREDIT" && paidAmount > 0) {
            await insertPayment(db, {
                storeId,
                customerId: customerId ?? null,
                saleId,
                amount: paidAmount,
                type: "RECEIVED",
                mode: paymentMode,
                referenceType: "SALE",
                referenceId: saleId,
                note: `Payment for ${existing.invoice_number}`,
                createdById: input.createdById,
            });
        }
    }
    return updated;
}
/**
 * Records a (partial) payment against a confirmed sale: for indented udhaar it
 * settles the linked udhaari entries up to the paid amount; otherwise it books
 * a ledger CREDIT (credit sales) and a payments row. The sale's paid/due
 * balances are adjusted without touching the immutable history.
 */
export async function recordSalePayment(db, storeId, saleId, userId, opts) {
    // FOR UPDATE: two concurrent payments would otherwise both read the same
    // due_amount, both pass the "exceeds due" check, and each write
    // paid_amount = paid + its own amount — collecting more than the invoice is
    // worth while the balance still reads as settled. The row lock serialises
    // the read-check-write sequence.
    const sale = await db.qOne(`SELECT * FROM sales WHERE id = $1 AND store_id = $2 FOR UPDATE`, [saleId, storeId]);
    if (!sale)
        throw ApiError.notFound("Sale not found");
    if (sale.status !== "CONFIRMED") {
        throw ApiError.conflict("Only confirmed sales can receive payments.");
    }
    if (dec(sale.due_amount).lte(0)) {
        throw ApiError.conflict("This invoice has no pending amount.");
    }
    const amount = money(opts.amount);
    if (amount.gt(dec(sale.due_amount))) {
        throw ApiError.badRequestCode("Payment exceeds due amount.", "PAYMENT_EXCEEDS_TOTAL");
    }
    const amountNum = amount.toNumber();
    const mode = opts.mode;
    // When the sale's Udhaar was tracked as a linked udhaari entry, settle that
    // entry (udhaari_payments + ledger CREDIT + payments row) instead of writing
    // a duplicate SALE credit — keeps the Udhaari section and customer ledger in
    // sync and is what makes the amount count as revenue.
    const allocated = await settleLinkedUdhaari(db, storeId, sale, amountNum, mode, userId);
    const remainder = money(dec(amountNum).minus(allocated));
    if (remainder.gt(0)) {
        if (sale.payment_mode === "CREDIT" && sale.customer_id) {
            await createLedgerEntry(db, {
                customerId: sale.customer_id,
                storeId,
                type: "CREDIT",
                amount: remainder.toNumber(),
                referenceType: "SALE",
                referenceId: saleId,
                note: `Payment for ${sale.invoice_number}`,
            });
        }
        await insertPayment(db, {
            storeId,
            customerId: sale.customer_id ?? null,
            saleId,
            amount: remainder.toNumber(),
            type: "RECEIVED",
            mode,
            referenceType: "SALE",
            referenceId: saleId,
            note: opts.note ?? `Payment for ${sale.invoice_number}`,
            createdById: userId,
        });
    }
    const newPaid = money(dec(sale.paid_amount).plus(amount));
    const newDue = money(dmax(0, dec(sale.total).minus(newPaid)));
    const updated = await db.qOne(`UPDATE sales SET paid_amount = $1, due_amount = $2, updated_at = now()
      WHERE id = $3
      RETURNING id, invoice_number, subtotal, discount, tax_total, total, paid_amount, due_amount, payment_mode, status, customer_id, created_at`, [newPaid.toNumber(), newDue.toNumber(), saleId]);
    if (!updated)
        throw new Error("Sale update failed");
    return updated;
}
