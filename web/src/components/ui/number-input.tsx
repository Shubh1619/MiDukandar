import * as React from "react";
import { Input } from "./input";
import { normalizeNumberInput } from "@/lib/number-format";

export { normalizeNumberInput };

interface NumberInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "type" | "inputMode" | "value" | "min" | "max" | "step"> {
  /** Raw string value (kept as a string so an empty field stays empty). */
  value: string;
  onChange: (value: string) => void;
  /** Allow a single leading minus. Defaults to false. */
  allowNegative?: boolean;
  /** Max digits after the decimal separator. Defaults to 2. */
  decimals?: number;
  /** Hard cap applied as a numeric bound on blur (optional). */
  max?: number;
  min?: number;
}

/**
 * Shared numeric input that fixes the classic "01" entry bug: typing 0 then 1
 * in a plain number/text field produced "01", which then parsed as 1 but was
 * shown and stored verbatim (and could reach the API as "01"). This component
 * keeps the value as a string (so an empty field stays empty rather than
 * becoming 0) and normalises on every change via normalizeNumberInput.
 */
export function NumberInput({
  value,
  onChange,
  allowNegative = false,
  decimals = 2,
  max,
  min,
  onBlur,
  ...props
}: NumberInputProps) {
  const handleChange = (raw: string) => {
    onChange(normalizeNumberInput(raw, allowNegative, decimals));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (value !== "" && value !== "-") {
      let n = Number(value);
      if (Number.isFinite(n)) {
        if (max != null && n > max) n = max;
        if (min != null && n < min) n = min;
        const clamped = String(n);
        if (clamped !== value) onChange(clamped);
      }
    }
    onBlur?.(e);
  };

  return (
    <Input
      type="text"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      {...props}
    />
  );
}
