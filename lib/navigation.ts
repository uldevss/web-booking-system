import type { NavItem } from "@/components/dashboard-nav";
import type { Role } from "@/lib/generated/prisma/enums";

// Sidebar navigation for each role's dashboard.

const shared: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/profile", label: "Profile", icon: "user" },
];

export const navigation: Record<Role, { title: string; items: NavItem[] }> = {
  CUSTOMER: {
    title: "My account",
    items: [
      { href: "/dashboard", label: "Overview", icon: "home", exact: true },
      { href: "/dashboard/bookings", label: "My bookings", icon: "calendar" },
      ...shared,
    ],
  },
  PROVIDER: {
    title: "Business",
    items: [
      { href: "/provider", label: "Overview", icon: "dashboard", exact: true },
      { href: "/provider/bookings", label: "Bookings", icon: "calendar" },
      { href: "/provider/services", label: "Booking options", icon: "services" },
      { href: "/provider/resources", label: "Staff & resources", icon: "users" },
      { href: "/provider/earnings", label: "Earnings", icon: "wallet" },
      { href: "/provider/reports", label: "Reports", icon: "chart" },
      { href: "/provider/profile", label: "Business profile", icon: "store" },
      ...shared,
    ],
  },
  EMPLOYEE: {
    title: "Staff",
    items: [{ href: "/employee", label: "My bookings", icon: "clipboard", exact: true }, ...shared],
  },
  ADMIN: {
    title: "Admin",
    items: [
      { href: "/admin", label: "Overview", icon: "chart", exact: true },
      { href: "/admin/providers", label: "Providers", icon: "store" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/bookings", label: "Bookings", icon: "calendar" },
      { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
      { href: "/admin/earnings", label: "Commission", icon: "wallet" },
      { href: "/admin/settings", label: "Payment settings", icon: "settings" },
      ...shared,
    ],
  },
};
