import "./load-env.js";
import pg from "pg";
import crypto from "node:crypto";

// Demo data must never be written to a production database. `seed:dev` is for
// local/test use only; refuse outright when NODE_ENV=production.
if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed: NODE_ENV=production. Demo data must never be written to production. " +
      "Run against a development/test database instead.",
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL as string;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

// Reimplementation of the money math used by the API (kept local).
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function main() {
  console.log("Seeding MiDukandar demo data...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Store
    const ownerRes = await client.query(
      `INSERT INTO users (email, name, role) VALUES ($1,$2,'OWNER') ON CONFLICT (email) DO NOTHING RETURNING id`,
      ["owner@midukandar.demo", "Demo Owner"],
    );
    const ownerIdRes = await client.query(`SELECT id FROM users WHERE email=$1`, ["owner@midukandar.demo"]);
    const ownerId = ownerIdRes.rows[0].id;

    const storeRes = await client.query(
      `SELECT s.id FROM stores s JOIN users u ON u.store_id = s.id WHERE u.id = $1`,
      [ownerId],
    );
    let storeId = storeRes.rows[0]?.id as string | undefined;
    if (!storeId) {
      const r = await client.query(
        `INSERT INTO stores (name, type, address, city, state, pincode, phone, gst, currency, language, invoice_prefix, plan_id, plan_status, trial_ends_at)
         VALUES ('Shubham Kirana Store','kirana','12, MG Road, Indore','Indore','Madhya Pradesh','452001','9876543210','23ABCDE1234F1Z5','INR','hi','INV',
                 (SELECT id FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1), 'TRIAL',
                 (SELECT CASE WHEN trial_days > 0 THEN now() + trial_days * interval '1 day' END
                    FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1))
         RETURNING id`,
      );
      storeId = r.rows[0].id;
      await client.query(`UPDATE users SET store_id=$1, role='OWNER' WHERE id=$2`, [storeId, ownerId]);
    }
    storeId = storeId as string;
    console.log(`Store ready: ${storeId}`);

    // 2) Products + opening stock
    const products = [
      ["Amul Butter 500g", "8901262010011", "Dairy", "pc", 280, 310, 315, 0, 5, "Amul Distributor"],
      ["Tata Salt 1kg", "8904063201016", "Grocery", "pc", 18, 22, 24, 0, 20, "Tata Consumer"],
      ["Aashirvaad Atta 5kg", "8901725110398", "Grocery", "bag", 210, 225, 235, 0, 8, "ITC Ltd"],
      ["Colgate MaxFresh 100g", "8901446600421", "Personal Care", "pc", 65, 80, 85, 18, 10, "Colgate"],
      ["Parle-G Gold 1kg", "8901719105278", "Snacks", "pc", 78, 90, 95, 0, 15, "Parle"],
      ["Fortune Sunflower Oil 1L", "8906023450131", "Oil", "bottle", 140, 155, 160, 0, 6, "Adani Wilmar"],
    ];
    const productIds: Record<string, string> = {};
    for (const [name, barcode, cat, unit, pp, sp, mrp, gst, min, supp] of products) {
      const existing = await client.query(`SELECT id FROM products WHERE store_id=$1 AND barcode=$2`, [storeId, barcode]);
      let pid = existing.rows[0]?.id as string | undefined;
      if (!pid) {
        const r = await client.query(
          `INSERT INTO products (store_id,name,barcode,category,unit,purchase_price,selling_price,mrp,gst_percent,min_stock,supplier)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [storeId, name, barcode, cat, unit, pp, sp, mrp, gst, min, supp],
        );
        pid = r.rows[0].id;
        await client.query(
          `INSERT INTO stock_movements (store_id,product_id,qty,type,reference_type,note,balance_after)
           VALUES ($1,$2,100,'OPENING','OPENING','Seed opening stock',100)`,
          [storeId, pid],
        );
      }
      productIds[name as string] = pid!;
    }
    console.log(`Products seeded: ${Object.keys(productIds).length}`);

    // 3) Customers + opening ledger
    const customers = [
      ["Ramesh Kumar", "9826012345", "22, Nayapura, Indore", 2000, 0],
      ["Suresh Jain", "9893012345", "8, Sarafa Bazaar, Indore", 5000, 500],
      ["Meena Devi", "9894012345", "3, Khajrana, Indore", 1000, 0],
    ];
    const customerIds: Record<string, string> = {};
    for (const [name, mobile, address, limit, opening] of customers) {
      const existing = await client.query(`SELECT id FROM customers WHERE store_id=$1 AND mobile=$2`, [storeId, mobile]);
      let cid = existing.rows[0]?.id as string | undefined;
      if (!cid) {
        const r = await client.query(
          `INSERT INTO customers (store_id,name,mobile,address,credit_limit,opening_balance)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [storeId, name, mobile, address, limit, opening],
        );
        cid = r.rows[0].id;
        if (Number(opening) > 0) {
          await client.query(
            `INSERT INTO ledger_entries (customer_id,store_id,type,amount,balance_after,reference_type,note)
             VALUES ($1,$2,'DEBIT',$3,$3,'OPENING','Opening balance')`,
            [cid, storeId, opening],
          );
        }
      }
      customerIds[name as string] = cid!;
    }
    console.log(`Customers seeded: ${Object.keys(customerIds).length}`);

    // 4) Demo transactions (only if store has none)
    const salesCount = await client.query(`SELECT COUNT(*)::int AS c FROM sales WHERE store_id=$1`, [storeId]);
    if (salesCount.rows[0].c === 0) {
      await insertSale(client, storeId, ownerId, [
        { pid: productIds["Amul Butter 500g"] as string, qty: 2 },
        { pid: productIds["Tata Salt 1kg"] as string, qty: 3 },
      ], "CASH", null, 0);
      await insertSale(client, storeId, ownerId, [
        { pid: productIds["Fortune Sunflower Oil 1L"] as string, qty: 1 },
      ], "CREDIT", customerIds["Ramesh Kumar"] as string, 0);
      await insertSale(client, storeId, ownerId, [
        { pid: productIds["Colgate MaxFresh 100g"] as string, qty: 2 },
      ], "UPI", customerIds["Meena Devi"] as string, 0);

      await insertPurchase(client, storeId, ownerId, [
        { pid: productIds["Parle-G Gold 1kg"] as string, qty: 50, price: 72 },
      ], "Parle Distributor", 2000);

      // Seed customer payment
      const balNow = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN type='DEBIT' THEN amount ELSE -amount END),0) AS bal
         FROM ledger_entries WHERE customer_id=$1`,
        [customerIds["Ramesh Kumar"] as string],
      );
      const curBal = Number(balNow.rows[0].bal);
      const pmt = curBal > 0 ? 155 : 0;
      if (pmt > 0) {
        const paymentRes = await client.query(
          `INSERT INTO payments (store_id,customer_id,amount,type,mode,reference_type,created_by_id)
           VALUES ($1,$2,$3,'RECEIVED','CASH','CUSTOMER_PAYMENT',$4) RETURNING id`,
          [storeId, customerIds["Ramesh Kumar"], pmt, ownerId],
        );
        await client.query(
          `INSERT INTO ledger_entries (customer_id,store_id,type,amount,balance_after,reference_type,reference_id,note)
           VALUES ($1,$2,'CREDIT',$3,$4,'PAYMENT',$5,'Seed customer payment')`,
          [customerIds["Ramesh Kumar"], storeId, pmt, curBal - pmt, paymentRes.rows[0].id],
        );
      }
      console.log("Demo transactions seeded (3 sales, 1 purchase, 1 payment)");
    } else {
      console.log("Transactions already exist - skipping.");
    }

    await client.query("COMMIT");
    console.log("Seed complete!");
    console.log("Demo login email: owner@midukandar.demo");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertSale(
  client: pg.PoolClient,
  storeId: string,
  creatorId: string,
  items: { pid: string; qty: number }[],
  mode: "CASH" | "UPI" | "CREDIT",
  customerId: string | null,
  paidOverride: number | null,
) {
  const seqRes = await client.query(
    `UPDATE stores SET invoice_sequence = invoice_sequence + 1 WHERE id=$1 RETURNING invoice_sequence, invoice_prefix`,
    [storeId],
  );
  const seq = seqRes.rows[0].invoice_sequence;
  const prefix = seqRes.rows[0].invoice_prefix;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `${prefix}-${ymd}-${String(seq).padStart(4, "0")}`;

  let subtotal = 0;
  let taxTotal = 0;
  const prepared: { pid: string; qty: number; price: number; gst: number; tax: number; lineTotal: number; name: string; barcode: string | null }[] = [];
  for (const it of items) {
    const p = await client.query(`SELECT name,barcode,selling_price,gst_percent FROM products WHERE id=$1`, [it.pid]);
    const row = p.rows[0];
    const unitPrice = Number(row.selling_price);
    const base = unitPrice * it.qty;
    const gst = Number(row.gst_percent);
    const tax = round2((base * gst) / 100);
    const line = round2(base + tax);
    subtotal += round2(base);
    taxTotal += tax;
    prepared.push({ pid: it.pid, qty: it.qty, price: unitPrice, gst, tax, lineTotal: line, name: row.name, barcode: row.barcode });
  }
  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  const total = round2(subtotal + taxTotal);
  const paid = mode === "CREDIT" ? (paidOverride ?? 0) : total;
  const due = mode === "CREDIT" ? round2(total - paid) : 0;

  const sale = await client.query(
    `INSERT INTO sales (store_id,invoice_number,customer_id,subtotal,discount,discount_type,tax_total,total,paid_amount,due_amount,payment_mode,status,notes,created_by_id)
     VALUES ($1,$2,$3,$4,0,'FLAT',$5,$6,$7,$8,$9,'CONFIRMED','Seed demo sale',$10) RETURNING id`,
    [storeId, invoiceNumber, customerId, subtotal, taxTotal, total, paid, due, mode, creatorId],
  );
  const saleId = sale.rows[0].id;

  const balCache: Record<string, number> = {};
  for (const it of prepared) {
    await client.query(
      `INSERT INTO sale_items (sale_id,product_id,product_name,barcode,qty,unit_price,discount,gst_percent,tax_amount,line_total)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9)`,
      [saleId, it.pid, it.name, it.barcode, it.qty, it.price, it.gst, it.tax, it.lineTotal],
    );
    const balRes = await client.query(`SELECT COALESCE(SUM(qty),0) AS bal FROM stock_movements WHERE product_id=$1`, [it.pid]);
    const before = Number(balRes.rows[0].bal);
    const after = before - it.qty;
    balCache[it.pid] = after;
    await client.query(
      `INSERT INTO stock_movements (store_id,product_id,qty,type,reference_type,reference_id,balance_after,note,created_by_id)
       VALUES ($1,$2,$3,'SALE','SALE',$4,$5,$6,$7)`,
      [storeId, it.pid, -it.qty, saleId, balCache[it.pid], `Sale ${invoiceNumber}`, creatorId],
    );
  }

  if (mode === "CREDIT" && customerId && due > 0) {
    const balRes = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN type='DEBIT' THEN amount ELSE -amount END),0) AS bal FROM ledger_entries WHERE customer_id=$1`,
      [customerId],
    );
    const after = Number(balRes.rows[0].bal) + due;
    await client.query(
      `INSERT INTO ledger_entries (customer_id,store_id,type,amount,balance_after,reference_type,reference_id,note)
       VALUES ($1,$2,'DEBIT',$3,$4,'SALE',$5,$6)`,
      [customerId, storeId, due, after, saleId, `Credit sale ${invoiceNumber}`],
    );
  }

  if (mode !== "CREDIT" && paid > 0) {
    await client.query(
      `INSERT INTO payments (store_id,customer_id,sale_id,amount,type,mode,reference_type,reference_id,note,created_by_id)
       VALUES ($1,$2,$3,$4,'RECEIVED',$5,'SALE',$6,$7,$8)`,
      [storeId, customerId, saleId, paid, mode, saleId, `Payment for ${invoiceNumber}`, creatorId],
    );
  }
}

async function insertPurchase(
  client: pg.PoolClient,
  storeId: string,
  creatorId: string,
  items: { pid: string; qty: number; price: number }[],
  supplier: string,
  paid: number,
) {
  const seqRes = await client.query(
    `UPDATE stores SET invoice_sequence = invoice_sequence + 1 WHERE id=$1 RETURNING invoice_sequence`,
    [storeId],
  );
  const seq = seqRes.rows[0].invoice_sequence;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const purchaseNumber = `PUR-${ymd}-${String(seq).padStart(4, "0")}`;

  let total = 0;
  const prepared: { pid: string; qty: number; price: number; gst: number; lineTotal: number; name: string; barcode: string | null }[] = [];
  for (const it of items) {
    const p = await client.query(`SELECT name,barcode,gst_percent FROM products WHERE id=$1`, [it.pid]);
    const row = p.rows[0];
    const gst = Number(row.gst_percent);
    const base = it.price * it.qty;
    const tax = round2((base * gst) / 100);
    const line = round2(base + tax);
    total += line;
    prepared.push({ pid: it.pid, qty: it.qty, price: it.price, gst, lineTotal: line, name: row.name, barcode: row.barcode });
  }
  total = round2(total);
  const paidAmount = Math.min(total, paid);
  const due = round2(total - paidAmount);
  const paymentStatus = due <= 0 ? "PAID" : "PARTIAL";

  const purchase = await client.query(
    `INSERT INTO purchases (store_id,purchase_number,supplier_name,subtotal,discount,tax_total,total,paid_amount,due_amount,payment_status,created_by_id)
     VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [storeId, purchaseNumber, supplier, round2(items.reduce((a, i) => a + i.price * i.qty, 0)), 0, total, paidAmount, due, paymentStatus, creatorId],
  );
  const purchaseId = purchase.rows[0].id;

  for (const it of prepared) {
    await client.query(
      `INSERT INTO purchase_items (purchase_id,product_id,product_name,barcode,qty,unit_price,gst_percent,tax_amount,line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8)`,
      [purchaseId, it.pid, it.name, it.barcode, it.qty, it.price, it.gst, it.lineTotal],
    );
    const balRes = await client.query(`SELECT COALESCE(SUM(qty),0) AS bal FROM stock_movements WHERE product_id=$1`, [it.pid]);
    const after = Number(balRes.rows[0].bal) + it.qty;
    await client.query(
      `INSERT INTO stock_movements (store_id,product_id,qty,type,reference_type,reference_id,balance_after,note,created_by_id)
       VALUES ($1,$2,$3,'PURCHASE','PURCHASE',$4,$5,$6,$7)`,
      [storeId, it.pid, it.qty, purchaseId, after, `Purchase ${purchaseNumber}`, creatorId],
    );
  }
}

void crypto;
main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});