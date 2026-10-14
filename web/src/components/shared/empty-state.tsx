"use client";

import type { ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";

interface EmptyStateProps {
  message: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ message, className = "py-12 text-center", children }: EmptyStateProps) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}

interface EmptyTableRowProps {
  colSpan: number;
  message: ReactNode;
  className?: string;
}

export function EmptyTableRow({ colSpan, message, className = "py-8 text-center" }: EmptyTableRowProps) {
  return (
    <TableRow>
      <TableCell className={className} colSpan={colSpan}>
        <span className="text-sm text-muted-foreground">{message}</span>
      </TableCell>
    </TableRow>
  );
}