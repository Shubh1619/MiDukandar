import AuthGate from "@/components/auth-gate";
import AppShell from "@/components/shell/app-shell";
import ImpersonationBanner from "@/components/impersonation/banner";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ImpersonationBanner />
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}