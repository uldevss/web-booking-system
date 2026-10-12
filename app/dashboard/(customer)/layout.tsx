import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { navigation } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(["CUSTOMER"]);
  return (
    <DashboardShell title={navigation.CUSTOMER.title} subtitle={user.name} nav={navigation.CUSTOMER.items}>
      {children}
    </DashboardShell>
  );
}
