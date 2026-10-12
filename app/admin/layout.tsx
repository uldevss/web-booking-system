import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { navigation } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(["ADMIN"]);
  return (
    <DashboardShell title={navigation.ADMIN.title} subtitle={user.name} nav={navigation.ADMIN.items}>
      {children}
    </DashboardShell>
  );
}
