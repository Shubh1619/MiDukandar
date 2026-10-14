import * as React from "react";
import { Input } from "./input";

interface MobileInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "type" | "inputMode" | "maxLength" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /** Maximum number of digits allowed. Defaults to 10 (Indian mobile). */
  maxDigits?: number;
}

/**
 * Shared mobile number input: numeric-only, strips non-digits and truncates to
 * `maxDigits`. Used everywhere a store/customer phone is collected.
 */
export function MobileInput({ value, onChange, maxDigits = 10, ...props }: MobileInputProps) {
  return (
    <Input
      type="tel"
      inputMode="numeric"
      maxLength={maxDigits}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
      {...props}
    />
  );
}