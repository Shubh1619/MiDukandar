"use client";

interface PaymentModeTabsProps {
  value: string;
  onChange: (mode: string) => void;
}

export function PaymentModeTabs({ value, onChange }: PaymentModeTabsProps) {
  return (
    <div className="flex gap-1.5">
      {["CASH", "UPI", "CARD"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${value === m ? "bg-primary text-primary-foreground" : "bg-background"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}