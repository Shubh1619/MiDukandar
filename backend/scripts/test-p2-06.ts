/**
 * Regression test — P2-06: storage object key injection via `entity` + filename ext.
 *
 * FAILS BEFORE the fix: `entity=a/../../../../x` is accepted by the route and
 *   the key extension is taken from the client filename.
 * PASSES AFTER the fix: the route rejects an unsafe `entity` with 400, and
 *   buildStoreKey() derives the extension from the content type and refuses any
 *   entity that is not a single safe path segment.
 *
 * Run:  npx tsx scripts/test-p2-06.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";
import * as storageMod from "../src/lib/storage.js";

const EMAIL = "owner@mazedukan.demo"; // tenant B (Pro); OTP rows cleared first
const STORE = "e9f8f5c3-ba70-4e63-9d36-15da3ac41885";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type KeyResult = { ok: true; key: string } | { ok: false; reason: string };
const buildStoreKey = (storageMod as unknown as Record<string, unknown>).buildStoreKey as
  | ((storeId: string, entity: string, contentType: string) => KeyResult)
  | undefined;

function multipart(filename: string, mimetype: string, content: Buffer) {
  const boundary = "----mdk" + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, content, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 0x41)]);

async function main(): Promise<void> {
  // ── Part A: pure key builder ──────────────────────────────────────────────
  if (!buildStoreKey) {
    check("buildStoreKey exported", false, "export missing (pre-fix code)");
  } else {
    const good = buildStoreKey(STORE, "images", "image/png");
    check(
      "valid entity produces storeId/image/<name>.png key",
      good.ok && good.key.startsWith(`${STORE}/images/`) && good.key.endsWith(".png"),
      JSON.stringify(good),
    );

    for (const bad of ["a/../../../../x", "..", "a\\b", "a\u0000b", "a/b", "with space"]) {
      const r = buildStoreKey(STORE, bad, "image/png");
      check(`unsafe entity rejected: ${JSON.stringify(bad)}`, !r.ok && r.reason === "unsafe_entity", JSON.stringify(r));
    }

    const badType = buildStoreKey(STORE, "images", "text/html");
    check("unsupported content type rejected", !badType.ok && badType.reason === "unsupported_type", JSON.stringify(badType));

    const jpg = buildStoreKey(STORE, "images", "image/jpeg");
    check(
      "extension follows content type, not filename",
      jpg.ok && jpg.key.endsWith(".jpg") && !jpg.key.includes(".."),
      JSON.stringify(jpg),
    );
  }

  // ── Part B: route rejects unsafe entity ───────────────────────────────────
  const app = buildApp({ logger: false });
  await app.ready();
  await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
  const otpRes = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: EMAIL } });
  const devOtp = (otpRes.json() as { devOtp?: string }).devOtp;
  if (!devOtp) throw new Error(`no devOtp: ${otpRes.statusCode} ${otpRes.body}`);
  const verifyRes = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { email: EMAIL, otp: devOtp } });
  const token = (verifyRes.json() as { accessToken?: string }).accessToken;
  if (!token) throw new Error(`verify failed: ${verifyRes.statusCode} ${verifyRes.body}`);

  async function upload(entity: string) {
    const mp = multipart("a.png", "image/png", PNG);
    const res = await app.inject({
      method: "POST",
      url: `/api/uploads/image?entity=${encodeURIComponent(entity)}`,
      headers: { authorization: `Bearer ${token}`, "content-type": mp.contentType },
      payload: mp.body,
    });
    return { status: res.statusCode, code: (res.json() as { code?: string }).code };
  }

  const evil = await upload("a/../../../../x");
  check("route rejects traversal entity (400)", evil.status === 400, `status=${evil.status} code=${evil.code}`);

  const okEntity = await upload("expenses");
  check("route accepts legit entity (reaches storage)", okEntity.status !== 400, `status=${okEntity.status} code=${okEntity.code}`);

  try {
    await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
    console.log(`[cleanup] cleared otps for ${EMAIL}`);
  } catch (e) {
    console.log(`[cleanup] WARN ${(e as Error).message}`);
  }

  await app.close();
  await pool.end();
  console.log(failed > 0 ? `\nP2-06 TEST FAILED: ${failed} check(s)` : "\nP2-06 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
