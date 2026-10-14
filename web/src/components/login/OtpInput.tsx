"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  obscure?: boolean;
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  obscure = false,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback(
    (index: number) => {
      const input = inputRefs.current[index];
      if (input) {
        input.focus();
        input.select();
      }
    },
    [],
  );

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (!/^\d*$/.test(digit)) return;
      const cells = Array.from({ length }, (_, i) => value[i] ?? "");
      cells[index] = digit.slice(-1);
      const result = cells.join("");
      onChange(result);
      const isComplete = cells.every((c) => c !== "");
      if (isComplete) {
        setTimeout(() => onComplete?.(result), 0);
      }
      if (digit && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [value, length, onChange, onComplete, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const newValue = value.split("");
        while (newValue.length < length) newValue.push("");
        if (newValue[index]) {
          newValue[index] = "";
          onChange(newValue.join(""));
        } else if (index > 0) {
          newValue[index - 1] = "";
          onChange(newValue.join(""));
          focusInput(index - 1);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < length - 1) {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [value, length, onChange, focusInput],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      onChange(pasted);
      const isComplete = pasted.length === length;
      if (isComplete) {
        onComplete?.(pasted);
      } else {
        focusInput(pasted.length);
      }
    },
    [length, onChange, onComplete, focusInput],
  );

  const digits = value.split("");
  while (digits.length < length) digits.push("");

  return (
    <div className="flex gap-2.5">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type={obscure ? "password" : "tel"}
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`otp-input h-14 w-11 rounded-xl border bg-white text-center font-display text-xl font-semibold text-navy-900 outline-none transition-all sm:w-12
            ${error ? "border-red-300 bg-red-50" : "border-slate-200 focus:border-royal-500"}
            ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-slate-300"}
          `}
          aria-label={`${obscure ? "PIN" : "OTP"} digit ${i + 1}`}
        />
      ))}
    </div>
  );
}