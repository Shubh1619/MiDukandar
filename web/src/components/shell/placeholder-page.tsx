import Link from "next/link";
import { Construction, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
        <Construction className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-lg font-bold text-navy-900">{title}</h1>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-5 flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
          <ShieldCheck className="size-3.5" />
          Routing-only placeholder
        </span>
      </div>
    </div>
  );
}