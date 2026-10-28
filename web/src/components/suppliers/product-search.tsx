"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatINR } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Input } from "@/components/ui/input";

export function ProductSearch({
  onSelect,
  inputClassName,
}: {
  onSelect: (p: Product) => void;
  inputClassName?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch<{ products: Product[] }>(
        `/api/products?search=${encodeURIComponent(term.trim())}&limit=20`,
      );
      setOptions(data.products);
      setOpen(true);
    } catch {
      setOptions([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(query), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, search]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length, query]);

  const list =
    open && options.length > 0 && rect
      ? createPortal(
          <div
            style={{ top: rect.top, left: rect.left, width: rect.width }}
            className="fixed z-[80] max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md ring-1 ring-foreground/10"
          >
            {options.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseUp={() => {
                  onSelect(p);
                  setQuery(p.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatINR(p.purchasePrice)}
                  {p.barcode ? ` · ${p.barcode}` : ""}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchor} className="relative min-w-0">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("selectProduct")}
        className={inputClassName ?? "pr-8"}
      />
      {busy && <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {list}
    </div>
  );
}