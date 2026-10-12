import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { navigation } from "@/lib/navigation";
import { requireProvider } from "@/lib/session";

export default async function ProviderLayout({ children }: { children: ReactNode }) {
  const { provider } = await requireProvider();
  return (
    <DashboardShell
      title={provider.businessName}
      subtitle={provider.isApproved ? "Listed" : "Awaiting approval"}
      nav={navigation.PROVIDER.items}
    >
      {children}
    </DashboardShell>
  );
}
