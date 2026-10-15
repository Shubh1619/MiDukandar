/**
 * Regression test — P2-05: upload magic-byte signatures rejected every real
 * image and accepted junk.
 *
 * FAILS BEFORE the fix: real PNG/JPEG/GIF/WEBP → 400 INVALID_MAGIC_BYTES;
 *   junk `FF FF 00 00` declared image/png → passes validation (503, i.e. it
 *   would have been stored).
 * PASSES AFTER the fix: each real format with a matching declared mimetype is
 *   accepted (reaches storage → 503 STORAGE_UNAVAILABLE because R2 is not
 *   configured in this env), while junk and content/mimetype mismatches are
 *   rejected with 400 INVALID_MAGIC_BYTES.
 *
 * Run:  npx tsx scripts/test-p2-05.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";
import type { FastifyInstance } from "fastify";

const EMAIL = "owner@mazedukan.demo"; // tenant B (Pro); OTP rows cleared first

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function multipart(filename: string, mimetype: string, content: Buffer) {
  const boundary = "----mdk" + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 0x41)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]), Buffer.alloc(16, 0x42)]);
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16, 0x43)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0x1a, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8 ", "latin1")]);
const JUNK = Buffer.from([0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

async function main(): Promise<void> {
  const app: FastifyInstance = buildApp({ logger: false });
  await app.ready();

  await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);

  const otpRes = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: EMAIL } });
  const devOtp = (otpRes.json() as { devOtp?: string }).devOtp;
  if (!devOtp) throw new Error(`no devOtp: ${otpRes.statusCode} ${otpRes.body}`);
  const verifyRes = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { email: EMAIL, otp: devOtp } });
  const token = (verifyRes.json() as { accessToken?: string }).accessToken;
  if (!token) throw new Error(`verify failed: ${verifyRes.statusCode} ${verifyRes.body}`);

  async function upload(filename: string, mimetype: string, content: Buffer) {
    const mp = multipart(filename, mimetype, content);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/image",
      headers: { authorization: `Bearer ${token}`, "content-type": mp.contentType },
      payload: mp.body,
    });
    return { status: res.statusCode, code: (res.json() as { code?: string }).code, body: res.body };
  }

  const cases: Array<[string, string, string, Buffer]> = [
    ["real PNG accepted", "a.png", "image/png", PNG],
    ["real JPEG accepted", "a.jpg", "image/jpeg", JPEG],
    ["real GIF accepted", "a.gif", "image/gif", GIF],
    ["real WEBP accepted", "a.webp", "image/webp", WEBP],
  ];
  for (const [name, filename, mime, buf] of cases) {
    const r = await upload(filename, mime, buf);
    check(name, r.code !== "INVALID_MAGIC_BYTES", `status=${r.status} code=${r.code}`);
  }

  const junk = await upload("junk.png", "image/png", JUNK);
  check("junk FF FF 00 00 rejected", junk.code === "INVALID_MAGIC_BYTES", `status=${junk.status} code=${junk.code}`);

  const mismatch = await upload("mismatch.jpg", "image/jpeg", PNG);
  check("PNG bytes declared image/jpeg rejected", mismatch.code === "INVALID_MAGIC_BYTES", `status=${mismatch.status} code=${mismatch.code}`);

  // ── cleanup: clear the OTP rows this run created ──────────────────────────
  try {
    await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
    console.log(`[cleanup] cleared otps for ${EMAIL}`);
  } catch (e) {
    console.log(`[cleanup] WARN ${(e as Error).message}`);
  }

  await app.close();
  await pool.end();
  console.log(failed > 0 ? `\nP2-05 TEST FAILED: ${failed} check(s)` : "\nP2-05 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
