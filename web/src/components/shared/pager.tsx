"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PagerProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  summary?: ReactNode;
  prevLabel?: string;
  nextLabel?: string;
}

export function Pager({
  page,
  pages,
  onPageChange,
  summary,
  prevLabel = "Prev",
  nextLabel = "Next",
}: PagerProps) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted-foreground">{summary ?? `Page ${page} of ${pages}`}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {prevLabel}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}