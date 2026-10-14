import SuperadminGate from "@/components/superadmin/gate";
import SuperadminShell from "@/components/superadmin/shell";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperadminGate>
      <SuperadminShell>{children}</SuperadminShell>
    </SuperadminGate>
  );
}