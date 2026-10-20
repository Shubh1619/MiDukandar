/**
 * Regression test — fix-05: PATCH /api/store/staff/:id accepted anything and
 * could deactivate the last Owner.
 *
 * FAILS BEFORE the fix: the handler read `(request.body ?? {}) as
 *   {isActive?: boolean}` with no schema — `PATCH {}` (or a missing body key)
 *   deactivates the user (`body.isActive ?? false`), an unknown id answers 200
 *   while updating 0 rows, and there is no last-Owner guard, so an owner can
 *   deactivate the only active Owner and lock the shop out of its own store.
 * PASSES AFTER: the body must be an explicit boolean (400 otherwise), unknown
 *   ids answer 404, and deactivating the last active Owner is refused with 400.
 *
 * Plan-module gating: USERS_ROLES is enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-05.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");

  const app = buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" });

  await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: "owner@midukandar.demo" } });
  const masterOtp = process.env.OTP_MASTER?.trim();
  if (!masterOtp) throw new Error("OTP_MASTER must be set in the environment");
  const verifyRes = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: masterOtp },
  });
  const auth = verifyRes.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!auth.accessToken) throw new Error("login failed: " + verifyRes.body);
  const storeId = auth.user?.storeId;
  const headers = { authorization: `Bearer ${auth.accessToken}`, "content-type": "application/json" };

  const planRes = await pool.query<{ plan_id: string }>(
    `SELECT plan_id FROM stores WHERE id = $1`, [storeId],
  );
  const planId = planRes.rows[0]?.plan_id;
  const MODULES = ["USERS_ROLES"];
  const prev = new Map<string, boolean>();
  if (planId) {
    const modRes = await pool.query<{ module_key: string; enabled: boolean }>(
      `SELECT module_key, enabled FROM plan_modules WHERE plan_id = $1 AND module_key = ANY($2::text[])`,
      [planId, MODULES],
    );
    for (const r of modRes.rows) prev.set(r.module_key, r.enabled);
    await pool.query(
      `UPDATE plan_modules SET enabled = TRUE WHERE plan_id = $1 AND module_key = ANY($2::text[])`,
      [planId, MODULES],
    );
  }

  const ownerRow = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE store_id = $1 AND role = 'OWNER' AND is_active = TRUE LIMIT 1`,
    [storeId],
  );
  const ownerId = ownerRow.rows[0]?.id;
  let toggledStaffId = "";
  let createdStaffId = "";

  try {
    // --- fixture: a staff member we are allowed to toggle -------------------
    const listRes = await app.inject({ method: "GET", url: "/api/store/staff", headers });
    const staff = (listRes.json() as { staff?: { id?: string; is_active?: boolean; isActive?: boolean }[] }).staff ?? [];
    check("fixtures: staff list responds", listRes.statusCode === 200, `status=${listRes.statusCode} count=${staff.length}`);

    let staffId = String(staff[0]?.id ?? "");
    if (!staffId) {
      const addRes = await app.inject({
        method: "POST", url: "/api/store/staff", headers,
        payload: { email: `fix05-staff-${Date.now()}@test.invalid`, name: "Fix05 Staff", role: "CASHIER" },
      });
      staffId = String((addRes.json() as { ok?: boolean }).ok ? (await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE store_id = $1 AND role <> 'OWNER' ORDER BY created_at DESC LIMIT 1`, [storeId],
      )).rows[0]?.id : "");
      createdStaffId = staffId;
      check("fixtures: staff member created", !!staffId, `status=${addRes.statusCode}`);
    }
    if (!staffId) throw new Error("no staff member available for the test");
    toggledStaffId = staffId;
    await pool.query(`UPDATE users SET is_active = TRUE WHERE id = $1`, [staffId]);
    const staffState = async (id: string): Promise<boolean | null> => {
      const r = await pool.query<{ is_active: boolean }>(`SELECT is_active FROM users WHERE id = $1`, [id]);
      return r.rows[0] ? r.rows[0].is_active : null;
    };

    // --- A: PATCH {} must not deactivate ------------------------------------
    const emptyBody = await app.inject({ method: "PATCH", url: `/api/store/staff/${staffId}`, headers, payload: {} });
    const stateAfterEmpty = await staffState(staffId);
    check(
      "fix-05 PATCH {} is rejected with 400",
      emptyBody.statusCode === 400,
      `status=${emptyBody.statusCode} body=${emptyBody.body.slice(0, 160)} is_active=${stateAfterEmpty}`,
    );
    check(
      "fix-05 PATCH {} left the user active",
      stateAfterEmpty !== false,
      `is_active=${stateAfterEmpty}`,
    );

    // --- B: explicit false / true still work --------------------------------
    const off = await app.inject({ method: "PATCH", url: `/api/store/staff/${staffId}`, headers, payload: { isActive: false } });
    const stateOff = await staffState(staffId);
    check(
      "fix-05 PATCH {isActive:false} deactivates (200)",
      off.statusCode === 200 && stateOff === false,
      `status=${off.statusCode} is_active=${stateOff}`,
    );
    const on = await app.inject({ method: "PATCH", url: `/api/store/staff/${staffId}`, headers, payload: { isActive: true } });
    const stateOn = await staffState(staffId);
    check(
      "fix-05 PATCH {isActive:true} reactivates (200)",
      on.statusCode === 200 && stateOn === true,
      `status=${on.statusCode} is_active=${stateOn}`,
    );

    // --- C: unknown id ------------------------------------------------------
    const missing = await app.inject({
      method: "PATCH", url: "/api/store/staff/00000000-0000-4000-8000-000000000000",
      headers, payload: { isActive: false },
    });
    check(
      "fix-05 unknown user id answers 404",
      missing.statusCode === 404,
      `status=${missing.statusCode} body=${missing.body.slice(0, 160)}`,
    );

    // --- D: last Owner must not be deactivatable (owner row restored below) -
    if (ownerId) {
      const lastOwner = await app.inject({ method: "PATCH", url: `/api/store/staff/${ownerId}`, headers, payload: { isActive: false } });
      const ownerState = await staffState(ownerId);
      check(
        "fix-05 deactivating the last active Owner is refused (400)",
        lastOwner.statusCode === 400,
        `status=${lastOwner.statusCode} body=${lastOwner.body.slice(0, 160)} owner_is_active=${ownerState}`,
      );
    } else {
      check("fix-05 deactivating the last active Owner is refused (400)", false, "no owner id");
    }
  } finally {
    await pool.query(`UPDATE users SET is_active = TRUE WHERE store_id = $1 AND role = 'OWNER'`, [storeId]);
    if (toggledStaffId) {
      await pool.query(`UPDATE users SET is_active = TRUE WHERE id = $1`, [toggledStaffId]);
    }
    if (createdStaffId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [createdStaffId]).catch(() => undefined);
    }
    if (planId) {
      for (const key of MODULES) {
        await pool.query(
          `UPDATE plan_modules SET enabled = $2 WHERE plan_id = $1 AND module_key = $3`,
          [planId, prev.get(key) ?? false, key],
        );
      }
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-05 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-05] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
