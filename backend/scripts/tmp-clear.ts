import { pool } from "../src/db/pool.js";
await pool.query("DELETE FROM otps");
await pool.end();
console.log("otps cleared");
