"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
}

export function TableSearch({
  value,
  onChange,
  placeholder,
  className,
  inputClassName = "pl-9",
  children,
}: TableSearchProps) {
  const { t } = useI18n();
  return (
    <div className={cn("relative min-w-52", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("search")}
        className={cn(inputClassName)}
      />
      {children}
    </div>
  );
}