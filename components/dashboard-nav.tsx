"use client";

import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  MessageSquareText,
  Scissors,
  Settings,
  Store,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Icons are referenced by name so server components can pass nav items.
const icons = {
  bell: Bell,
  briefcase: Briefcase,
  calendar: CalendarDays,
  chart: BarChart3,
  clipboard: ClipboardList,
  home: Home,
  dashboard: LayoutDashboard,
  reviews: MessageSquareText,
  services: Scissors,
  settings: Settings,
  store: Store,
  user: UserRound,
  users: Users,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; icon: keyof typeof icons; exact?: boolean };

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Section" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
