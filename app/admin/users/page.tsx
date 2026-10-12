import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { setUserActive } from "@/app/admin/actions";
import { ActionButton } from "@/components/action-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageNumber, PAGE_SIZE } from "@/lib/booking-filters";
import { formatDate } from "@/lib/format";
import type { Prisma, Role } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, roleLabels } from "@/lib/roles";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireUser(["ADMIN"]);
  const params = flattenParams(await searchParams);
  const q = params.q?.trim().slice(0, 100) ?? "";
  const role = ALL_ROLES.includes(params.role as Role) ? (params.role as Role) : undefined;
  const page = pageNumber(params);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const roleHref = (value?: Role) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (value) query.set("role", value);
    const qs = query.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <>
      <PageHeader title="Users" description={`${total} account${total === 1 ? "" : "s"}`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex gap-2" role="search">
          {role ? <input type="hidden" name="role" value={role} /> : null}
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <SearchBox scope="users" id="user-search" name="q" defaultValue={q} placeholder="Name, email or phone" wrapperClassName="w-64" />
          <Button type="submit" variant="secondary">
            <Search aria-hidden />
            Search
          </Button>
        </form>
        <nav aria-label="Filter by role" className="flex flex-wrap gap-1">
          {[undefined, ...ALL_ROLES].map((value) => (
            <Link
              key={value ?? "all"}
              href={roleHref(value)}
              aria-current={role === value ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                role === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {value ? roleLabels[value] : "All"}
            </Link>
          ))}
        </nav>
      </div>
      {users.length ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className="font-medium">{user.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {user.email}
                        {user.phone ? ` · ${user.phone}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>{roleLabels[user.role]}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{user._count.bookings}</TableCell>
                    <TableCell>
                      {user.isActive ? "Active" : <span className="font-medium text-destructive">Suspended</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.id === admin.id ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : user.isActive ? (
                        <ActionButton
                          size="sm"
                          variant="outline"
                          action={setUserActive.bind(null, user.id, false)}
                          confirmText={`Suspend ${user.name}? They won't be able to sign in.`}
                        >
                          Suspend
                        </ActionButton>
                      ) : (
                        <ActionButton size="sm" variant="outline" action={setUserActive.bind(null, user.id, true)}>
                          Reactivate
                        </ActionButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/users" params={params} />
        </>
      ) : (
        <EmptyState title="No users found" />
      )}
    </>
  );
}
