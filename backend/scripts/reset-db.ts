import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL as string;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE
        stock_movements, sale_items, purchase_items,
        ledger_entries, payments, held_bills,
        sales, purchases, customers, products,
        refresh_tokens, otps,
        users CASCADE
    `);
    await client.query(`DELETE FROM stores`);
    await client.query(`ALTER SEQUENCE schema_migrations_id_seq RESTART WITH 1`);
    await client.query("COMMIT");
    console.log("Database reset complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reset failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

void main();