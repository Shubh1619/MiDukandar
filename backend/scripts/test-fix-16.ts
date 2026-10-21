/**
 * Regression test - fix-16: the "01" number-entry bug.
 *
 * Typing 0 then 1 into the old `type="number"` string-state inputs stored "01"
 * verbatim and could POST "01" to the API. The shared NumberInput now
 * normalises every keystroke through normalizeNumberInput() (web/src/lib/
 * number-format.ts). This test pins that pure function's behaviour.
 *
 * Run:  npx tsx scripts/test-fix-16.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { normalizeNumberInput } from "../../web/src/lib/number-format.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function expect(label: string, input: string, expected: string, allowNegative = false, decimals = 2): void {
  const got = normalizeNumberInput(input, allowNegative, decimals);
  check(`fix-16 ${label}: "${input}" -> "${expected}"`, got === expected, `got "${got}"`);
}

// The headline bug: a leading zero must not survive.
expect("leading zero is stripped", "01", "1");
expect("multiple leading zeros are stripped", "00012", "12");
expect("zero alone is preserved", "0", "0");
expect("zero before a decimal is preserved", "0.5", "0.5");
expect("leading zeros before a decimal collapse", "00.5", "0.5");

// Decimal handling.
expect("only two decimals are kept", "1.239", "1.23");
expect("one decimal separator only", "1.2.3", "1.23");
expect("lone separator becomes 0.", ".", "0.");
expect("separator after digits is kept while typing", "1.", "1.");
expect("empty stays empty", "", "");

// Non-numeric characters are dropped.
expect("letters are dropped", "1a2", "12");
expect("currency/spaces are dropped", "₹ 1,200", "1200");

// Negative handling.
expect("minus is dropped when disallowed", "-5", "5");
expect("minus is kept when allowed", "-5", "-5", true);
expect("negative leading zero stripped", "-05", "-5", true);

// Integer-only mode.
expect("integer mode drops the decimal", "1.9", "1", false, 0);

console.log(failed === 0 ? "\nALL FIX-16 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
