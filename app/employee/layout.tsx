import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { navigation } from "@/lib/navigation";
import { requireStaff } from "@/lib/session";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const { resource } = await requireStaff();
  return (
    <DashboardShell title={navigation.EMPLOYEE.title} subtitle={resource.provider.businessName} nav={navigation.EMPLOYEE.items}>
      {children}
    </DashboardShell>
  );
}
