// Section C - Core business flows (products, sales, held bills, purchases, suppliers, expenses, udhaari, inventory)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { API, DATA_DIR, http, t } from "./lib.mjs";

const api = (method, p, opts) => http(method, `${API}/api${p}`, opts);
const A = JSON.parse(await readFile(path.join(DATA_DIR, "accounts.json"), "utf8"));
const s1 = A.store1.owner.token;      // OWNER (Pro)
const mgr = A.staff.manager.token;    // MANAGER
const cash = A.staff.cashier.token;   // CASHIER

const created = {};
const tag = "QA-" + Date.now().toString().slice(-6);
console.log("run tag:", tag);

// ---- Products ------------------------------------------------------------
await t("C01", "Create product (opening stock) -> 201", async () => {
  const r = await api("POST", "/products", {
    token: mgr,
    body: { name: `${tag} Rice 25kg`, sku: `${tag}-RICE`, barcode: "", unit: "bag", purchasePrice: 900, sellingPrice: 1050, gstPercent: 5, minStock: 5, openingStock: 50 },
  });
  created.productId = r.json?.product?.id;
  created.productName = r.json?.product?.name;
  return { pass: r.status === 201 && !!created.productId, expected: "201 + product.id", actual: `${r.status} id=${created.productId}`, evidence: (r.text ?? "").slice(0, 160) };
});

await t("C02", "Created product appears in product list", async () => {
  const r = await api("GET", `/products?search=${encodeURIComponent(tag)}`, { token: mgr });
  const found = (r.json?.products ?? []).some((p) => p.id === created.productId);
  return { pass: r.status === 200 && found, expected: "200 + found", actual: `${r.status} found=${found}` };
});

await t("C03", "Duplicate product NAME blocked even when existing product has a SKU", async () => {
  const r = await api("POST", "/products", { token: mgr, body: { name: created.productName || `${tag} Rice 25kg` } });
  return {
    pass: r.status === 409,
    expected: "409 PRODUCT_EXISTS",
    actual: `${r.status}`,
    severity: "medium",
    notes: "findDuplicate() only compares name when the EXISTING row has NULL sku AND barcode; the cloned name was accepted because C01 set a SKU.",
  };
});

await t("C03b", "Duplicate name (both entries without sku/barcode) -> 409", async () => {
  const a = await api("POST", "/products", { token: mgr, body: { name: `${tag} NoSku Item` } });
  const b = await api("POST", "/products", { token: mgr, body: { name: `${tag} NoSku Item` } });
  return { pass: a.status === 201 && b.status === 409, expected: "201 then 409", actual: `first=${a.status} second=${b.status}` };
});

await t("C04", "Product detail returns stock summary", async () => {
  const r = await api("GET", `/products/${created.productId}`, { token: mgr });
  return { pass: r.status === 200 && r.json?.product?.id === created.productId, expected: "200", actual: `${r.status} stock=${r.json?.product?.stockQuantity ?? r.json?.product?.currentStock ?? "n/a"}` };
});

await t("C05", "Update product -> 200", async () => {
  const r = await api("PUT", `/products/${created.productId}`, { token: mgr, body: { name: `${tag} Rice 25kg`, sellingPrice: 1100 } });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

// ---- Customers -----------------------------------------------------------
await t("C06", "Create customer -> 201", async () => {
  const r = await api("POST", "/customers", { token: mgr, body: { name: `${tag} Customer`, mobile: "9000000001" } });
  created.customerId = r.json?.customer?.id;
  return { pass: r.status === 201 && !!created.customerId, expected: "201", actual: `${r.status} id=${created.customerId}` };
});

// ---- Sales ---------------------------------------------------------------
await t("C07", "Create CASH sale (product line) -> 201 + invoice number", async () => {
  const r = await api("POST", "/sales", {
    token: cash,
    body: {
      customerId: created.customerId,
      lines: [{ productId: created.productId, qty: 2, unitPrice: 1100, gstPercent: 5, discount: 0 }],
      paymentMode: "CASH",
      discount: 0,
      discountType: "FLAT",
      paidAmount: 2310,
    },
  });
  created.saleId = r.json?.sale?.id;
  created.invoiceNumber = r.json?.sale?.invoice_number;
  return { pass: r.status === 201 && !!created.saleId && !!created.invoiceNumber, expected: "201 + invoice_number", actual: `${r.status} invoice=${created.invoiceNumber}`, evidence: (r.text ?? "").slice(0, 200) };
});

await t("C08", "Sale detail returns line items", async () => {
  const r = await api("GET", `/sales/${created.saleId}`, { token: cash });
  const items = r.json?.sale?.items ?? [];
  return { pass: r.status === 200 && items.length === 1, expected: "200 + 1 item", actual: `${r.status} items=${items.length}` };
});

await t("C09", "Invoice data endpoint returns totals", async () => {
  const r = await api("GET", `/sales/${created.saleId}/invoice`, { token: cash });
  return { pass: r.status === 200 && !!r.json?.invoice?.invoiceNumber, expected: "200", actual: `${r.status} total=${r.json?.invoice?.total}` };
});

await t("C10", "Invoice PDF download returns a PDF", async () => {
  const r = await http("GET", `${API}/api/sales/${created.saleId}/invoice/pdf`, { token: cash });
  const isPdf = (r.text ?? "").startsWith("%PDF");
  return { pass: r.status === 200 && isPdf && /application\/pdf/.test(r.headers["content-type"] ?? ""), expected: "200 application/pdf", actual: `${r.status} ct=${r.headers["content-type"]} pdf=${isPdf}` };
});

await t("C11", "Create CREDIT (udhaar) sale leaves due amount", async () => {
  const r = await api("POST", "/sales", {
    token: cash,
    body: {
      customerId: created.customerId,
      lines: [{ productId: created.productId, qty: 1, unitPrice: 1100, gstPercent: 0, discount: 0 }],
      paymentMode: "CREDIT",
      paidAmount: 0,
      udhaar: { dueDate: "2026-12-31" },
    },
  });
  created.creditSaleId = r.json?.sale?.id;
  const due = Number(r.json?.sale?.due_amount ?? r.json?.sale?.dueAmount);
  return { pass: r.status === 201 && due > 0, expected: "201 with due>0", actual: `${r.status} due=${due}` };
});

await t("C12", "Record partial payment on credit sale", async () => {
  const r = await api("POST", `/sales/${created.creditSaleId}/pay`, { token: cash, body: { amount: 100, mode: "CASH" } });
  return { pass: r.status === 200, expected: "200", actual: `${r.status} due=${r.json?.sale?.due_amount ?? r.json?.sale?.dueAmount}` };
});

await t("C13", "Overpayment beyond due on credit sale -> 4xx", async () => {
  const r = await api("POST", `/sales/${created.creditSaleId}/pay`, { token: cash, body: { amount: 999999, mode: "CASH" } });
  return { pass: r.status >= 400 && r.status < 500, expected: "4xx", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C14", "Reverse a sale (cash sale) -> ok", async () => {
  const r = await api("POST", `/sales/${created.saleId}/reverse`, { token: s1, body: { reason: "QA reversal test" } });
  return { pass: r.status === 200 && r.json?.ok === true, expected: "200 {ok:true}", actual: `${r.status}` };
});

// ---- Held bills ----------------------------------------------------------
await t("C15", "Hold a bill with a label -> bill_number=label", async () => {
  const r = await api("POST", "/sales/hold", { token: cash, body: { label: `${tag} Table 5`, payload: { lines: [{ productId: created.productId, qty: 3 }], note: "held" } } });
  created.heldId = r.json?.heldBill?.id;
  return { pass: r.status === 201 && r.json?.heldBill?.bill_number === `${tag} Table 5`, expected: "201 bill_number=label", actual: `${r.status} bill=${r.json?.heldBill?.bill_number}` };
});

await t("C16", "Held bill appears in held list", async () => {
  const r = await api("GET", "/sales/held/list", { token: cash });
  const found = (r.json?.heldBills ?? []).some((h) => h.id === created.heldId);
  return { pass: r.status === 200 && found, expected: "200 + found", actual: `${r.status} count=${r.json?.heldBill?.length ?? r.json?.heldBills?.length} found=${found}` };
});

await t("C17b", "Get single held bill", async () => {
  const r = await api("GET", `/sales/held/${created.heldId}`, { token: cash });
  return { pass: r.status === 200 && r.json?.heldBill?.id === created.heldId, expected: "200", actual: `${r.status}` };
});

await t("C16b", "Hold a bill without label gets HLD- default", async () => {
  const r = await api("POST", "/sales/hold", { token: cash, body: { payload: { lines: [] } } });
  const bn = r.json?.heldBill?.bill_number ?? "";
  if (r.json?.heldBill?.id) created.held2 = r.json.heldBill.id;
  return { pass: r.status === 201 && /^HLD-\d+/.test(bn), expected: "201 HLD-<ts>", actual: `${r.status} bill_number=${bn}` };
});

await t("C16c", "Delete held bill -> ok", async () => {
  const r = await api("DELETE", `/sales/held/${created.heldId}`, { token: cash });
  const list = await api("GET", "/sales/held/list", { token: cash });
  const still = (list.json?.heldBills ?? []).some((h) => h.id === created.heldId);
  return { pass: r.status === 200 && !still, expected: "200 + removed", actual: `${r.status} stillPresent=${still}` };
});

// ---- Suppliers + purchase orders + payments ------------------------------
await t("C17", "Create supplier -> 201", async () => {
  const r = await api("POST", "/suppliers", { token: mgr, body: { name: `${tag} Supplier`, phone: "9000000002", email: "s@demo.local" } });
  created.supplierId = r.json?.supplier?.id;
  return { pass: r.status === 201 && !!created.supplierId, expected: "201", actual: `${r.status} id=${created.supplierId}` };
});

await t("C18", "Create purchase order (draft) -> 201", async () => {
  const r = await api("POST", "/purchase-orders", {
    token: mgr,
    body: { supplierId: created.supplierId, status: "draft", lines: [{ productId: created.productId, quantity: 10, rate: 900, taxRate: 5 }] },
  });
  created.poId = r.json?.purchaseOrder?.id;
  return { pass: r.status === 201 && !!created.poId, expected: "201", actual: `${r.status} po=${r.json?.purchaseOrder?.po_number}` };
});

await t("C19", "PO draft -> sent", async () => {
  const r = await api("PATCH", `/purchase-orders/${created.poId}/status`, { token: mgr, body: { status: "sent" } });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C20", "PO sent -> received (creates stock)", async () => {
  const r = await api("PATCH", `/purchase-orders/${created.poId}/status`, { token: mgr, body: { status: "received" } });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C21", "PO invalid transition received -> sent -> 409", async () => {
  const r = await api("PATCH", `/purchase-orders/${created.poId}/status`, { token: mgr, body: { status: "sent" } });
  return { pass: r.status === 409, expected: "409", actual: `${r.status}` };
});

await t("C22", "Supplier detail includes purchaseOrders + payments", async () => {
  const r = await api("GET", `/suppliers/${created.supplierId}`, { token: mgr });
  return { pass: r.status === 200 && Array.isArray(r.json?.purchaseOrders) && Array.isArray(r.json?.payments), expected: "200 {supplier,purchaseOrders,payments}", actual: `${r.status} pos=${r.json?.purchaseOrders?.length} payments=${r.json?.payments?.length} outstanding=${r.json?.supplier?.outstanding_payable}` };
});

await t("C23", "Supplier payment within outstanding -> 201", async () => {
  const r = await api("POST", `/suppliers/${created.supplierId}/payments`, { token: mgr, body: { amount: 1000, paymentMode: "CASH", note: "QA payment" } });
  return { pass: r.status === 201, expected: "201", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C24", "Supplier payment exceeding outstanding -> 400 PAYMENT_EXCEEDS_OUTSTANDING", async () => {
  const r = await api("POST", `/suppliers/${created.supplierId}/payments`, { token: mgr, body: { amount: 9999999, paymentMode: "CASH" } });
  return { pass: r.status === 400 && /PAYMENT_EXCEEDS_OUTSTANDING|exceeds/i.test(r.text ?? ""), expected: "400 PAYMENT_EXCEEDS_OUTSTANDING", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C25", "Supplier payment history returns recorded payment", async () => {
  const r = await api("GET", `/suppliers/${created.supplierId}/payments`, { token: mgr });
  const ok = r.status === 200 && (r.json?.payments ?? []).some((p) => Number(p.amount) === 1000);
  return { pass: ok, expected: "200 with payment of 1000", actual: `${r.status} count=${r.json?.payments?.length}` };
});

await t("C26", "Supplier reorder-message builds WhatsApp link from last PO", async () => {
  const r = await api("GET", `/suppliers/${created.supplierId}/reorder-message`, { token: mgr });
  return { pass: r.status === 200 && r.json?.hasPo === true && /wa\.me/.test(r.json?.waLink ?? ""), expected: "200 hasPo + waLink", actual: `${r.status} hasPo=${r.json?.hasPo} link=${(r.json?.waLink ?? "").slice(0, 40)}` };
});

await t("C27", "Supplier delete blocked while non-cancelled PO exists -> 409", async () => {
  const r = await api("DELETE", `/suppliers/${created.supplierId}`, { token: mgr });
  return { pass: r.status === 409, expected: "409 SUPPLIER_HAS_ACTIVE_POS", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

// ---- Expenses ------------------------------------------------------------
await t("C28", "Create expense category -> 201", async () => {
  const r = await api("POST", "/expenses/categories", { token: mgr, body: { name: `${tag} Utilities` } });
  created.catId = r.json?.category?.id;
  return { pass: r.status === 201, expected: "201", actual: `${r.status}` };
});

await t("C29", "Create expense -> 201", async () => {
  const r = await api("POST", "/expenses", { token: mgr, body: { title: `${tag} Electricity`, amount: 1500, categoryId: created.catId, paymentMode: "CASH", expenseDate: "2026-10-01" } });
  created.expenseId = r.json?.expense?.id;
  return { pass: r.status === 201, expected: "201", actual: `${r.status}` };
});

await t("C30", "Expense summary returns totals", async () => {
  const r = await api("GET", "/expenses/summary", { token: mgr });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C31", "Create recurring expense at REST path POST /api/recurring-expenses -> 201", async () => {
  const r = await api("POST", "/recurring-expenses", { token: mgr, body: { title: `${tag} Rent`, amount: 5000, frequency: "MONTHLY", nextDueDate: "2026-11-01", paymentMode: "BANK" } });
  created.recurringId = r.json?.recurring?.id;
  return { pass: r.status === 201, expected: "201", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C32", "List recurring expenses: GET /api/recurring-expenses is inconsistent (404); real list is /recurring", async () => {
  const natural = await api("GET", "/recurring-expenses", { token: mgr });
  const working = await api("GET", "/recurring-expenses/recurring", { token: mgr });
  return {
    pass: !(natural.status === 200),
    status: "WARN",
    severity: "medium",
    expected: "GET /api/recurring-expenses returns 200 (natural REST path)",
    actual: `GET /api/recurring-expenses=${natural.status}, GET /api/recurring-expenses/recurring=${working.status}`,
    notes: "The recurring-expense router exposes list at '/recurring' while create/update/delete use the bare prefix, so the natural GET /api/recurring-expenses 404s. No web/mobile client calls these endpoints.",
  };
});

await t("C33", "Process due recurring expenses responds", async () => {
  const r = await api("POST", "/recurring-expenses/recurring/process-due", { token: mgr, body: {} });
  return { pass: r.status >= 200 && r.status < 300, expected: "2xx", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C34", "Expense creation with zero amount -> 400", async () => {
  const r = await api("POST", "/expenses", { token: mgr, body: { title: "Zero", amount: 0 } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

// ---- Udhaari + payments --------------------------------------------------
await t("C35", "Create udhaari entry -> 201", async () => {
  const r = await api("POST", "/udhaari", { token: mgr, body: { customerId: created.customerId, amount: 500, note: "QA udhaar" } });
  created.udhaariId = r.json?.entry?.id ?? r.json?.udhaari?.id ?? r.json?.id;
  return { pass: r.status === 201, expected: "201", actual: `${r.status} id=${created.udhaariId}` };
});

await t("C36", "Udhaari list -> 200", async () => {
  const r = await api("GET", "/udhaari", { token: mgr });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C45", "Pay udhaari entry -> ok", async () => {
  if (!created.udhaariId) return { pass: false, status: "SKIP", notes: "no udhaari id" };
  const r = await api("POST", `/udhaari/${created.udhaariId}/pay`, { token: mgr, body: { amount: 200, mode: "CASH" } });
  return { pass: r.status >= 200 && r.status < 300, expected: "2xx", actual: `${r.status} ${(r.text ?? "").slice(0, 120)}` };
});

await t("C46", "Receive customer payment -> 201", async () => {
  const r = await api("POST", "/payments/receive", { token: mgr, body: { customerId: created.customerId, amount: 50, mode: "CASH" } });
  return { pass: r.status === 201, expected: "201", actual: `${r.status}` };
});

// ---- Inventory -----------------------------------------------------------
await t("C47", "Inventory stock/current -> 200", async () => {
  const r = await api("GET", "/inventory/stock/current", { token: mgr });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C48", "Inventory stock/low -> 200", async () => {
  const r = await api("GET", "/inventory/stock/low", { token: mgr });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

await t("C49", "Inventory movements -> 200", async () => {
  const r = await api("GET", "/inventory/movements", { token: mgr });
  return { pass: r.status === 200, expected: "200", actual: `${r.status}` };
});

// ---- Validation edge cases ----------------------------------------------
await t("C38", "Sale with qty=0 -> 400", async () => {
  const r = await api("POST", "/sales", { token: cash, body: { lines: [{ productName: "x", qty: 0 }], paymentMode: "CASH" } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("C39", "Sale with empty lines -> 400", async () => {
  const r = await api("POST", "/sales", { token: cash, body: { lines: [], paymentMode: "CASH" } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("C40", "Sale with negative discount -> 400", async () => {
  const r = await api("POST", "/sales", { token: cash, body: { lines: [{ productName: "x", qty: 1 }], paymentMode: "CASH", discount: -5 } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await t("C41", "Product with invalid gstPercent (>100) -> 400", async () => {
  const r = await api("POST", "/products", { token: mgr, body: { name: `${tag} Bad GST`, gstPercent: 150 } });
  return { pass: r.status === 400, expected: "400", actual: `${r.status}` };
});

await writeFile(path.join(DATA_DIR, "fixtures-created.json"), JSON.stringify({ tag, created }, null, 2));
console.log("\nSection C complete.");
