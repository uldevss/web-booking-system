import type { ReactNode } from "react";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";

/** Side navigation on wide screens, a scrollable tab row on phones. */
export function DashboardShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-6 lg:py-8">
      <aside className="mb-6 lg:mb-0">
        <div className="mb-3 hidden lg:block">
          <p className="text-sm font-semibold">{title}</p>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        <DashboardNav items={nav} />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
