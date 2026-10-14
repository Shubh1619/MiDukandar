"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  className?: string;
  padded?: boolean;
}

export function TableSkeleton({ rows = 6, className = "h-9", padded = true }: TableSkeletonProps) {
  return (
    <div className={cn("space-y-2", padded && "p-4")}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}