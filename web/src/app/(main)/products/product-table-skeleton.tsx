"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ProductTableSkeleton({ showPurchase }: { showPurchase: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Expiry</TableHead>
          {showPurchase ? <TableHead className="text-right">Purchase</TableHead> : null}
          <TableHead className="text-right">Selling</TableHead>
          <TableHead className="text-right">GST</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="w-14 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 7 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 rounded-md" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            {showPurchase ? (
              <TableCell>
                <Skeleton className="ml-auto h-4 w-14" />
              </TableCell>
            ) : null}
            <TableCell>
              <Skeleton className="ml-auto h-4 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-10" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-5 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto size-8 rounded-md" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}