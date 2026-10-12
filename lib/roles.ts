import type { Role } from "@/lib/generated/prisma/enums";

// Who may open which area. Used by the proxy for fast redirects; pages,
// server actions and API routes re-check against the database.

export const ALL_ROLES: Role[] = ["CUSTOMER", "PROVIDER", "EMPLOYEE", "ADMIN"];

export const roleLabels: Record<Role, string> = {
  CUSTOMER: "Customer",
  PROVIDER: "Provider",
  EMPLOYEE: "Employee",
  ADMIN: "Admin",
};

/** Where each role lands after signing in. */
export function homePathFor(role: Role | undefined) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PROVIDER":
      return "/provider";
    case "EMPLOYEE":
      return "/employee";
    default:
      return "/dashboard";
  }
}

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Roles allowed to open `pathname`, or null if the page is public. */
export function rolesForPath(pathname: string): Role[] | null {
  if (pathname === "/provider/register") return null;
  if (within(pathname, "/admin")) return ["ADMIN"];
  if (within(pathname, "/provider")) return ["PROVIDER"];
  if (within(pathname, "/employee")) return ["EMPLOYEE"];
  if (within(pathname, "/dashboard/profile") || within(pathname, "/notifications")) return ALL_ROLES;
  if (within(pathname, "/dashboard")) return ["CUSTOMER"];
  return null;
}
