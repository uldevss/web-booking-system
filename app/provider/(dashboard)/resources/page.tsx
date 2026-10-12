import { Plus, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { addSelfAsStaff } from "@/app/provider/actions";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resourceKinds, resourceName } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Staff & resources" };

const DAY_LETTERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default async function ResourcesPage() {
  const { user, provider } = await requireProvider();
  const resources = await prisma.resource.findMany({
    where: { providerId: provider.id },
    include: {
      user: { select: { name: true, email: true } },
      schedules: { select: { dayOfWeek: true } },
      services: { select: { name: true, bookingType: true } },
    },
    orderBy: [{ isActive: "desc" }, { kind: "asc" }, { name: "asc" }, { createdAt: "asc" }],
  });
  const ownerIsStaff = resources.some((resource) => resource.userId === user.id);

  return (
    <>
      <PageHeader
        title="Staff & resources"
        description="What guests actually book: rooms, rental units, tables and spaces, or staff such as tour guides. Each booking is assigned to a free one."
        actions={
          <>
            {!ownerIsStaff ? (
              <form action={addSelfAsStaff}>
                <Button type="submit" variant="outline">
                  <UserPlus aria-hidden />I host bookings myself
                </Button>
              </form>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/provider/resources/new?type=staff">
                <UserPlus aria-hidden />
                Add staff
              </Link>
            </Button>
            <Button asChild>
              <Link href="/provider/resources/new">
                <Plus aria-hidden />
                Add room, table or space
              </Link>
            </Button>
          </>
        }
      />
      {resources.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Open on</TableHead>
                <TableHead>Booking options</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => {
                const days = new Set(resource.schedules.map((s) => s.dayOfWeek));
                const onlyStays = resource.services.length > 0 && resource.services.every((s) => s.bookingType === "NIGHTLY");
                return (
                  <TableRow key={resource.id} className="relative">
                    <TableCell>
                      <Link href={`/provider/resources/${resource.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {resourceName(resource)}
                        {resource.userId === user.id ? " (you)" : ""}
                      </Link>
                      {resource.user ? <span className="block text-xs text-muted-foreground">{resource.user.email}</span> : null}
                    </TableCell>
                    <TableCell>{resourceKinds[resource.kind].label}</TableCell>
                    <TableCell>
                      {onlyStays ? (
                        <span className="text-xs text-muted-foreground">Every night</span>
                      ) : days.size ? (
                        <span className="flex gap-1" aria-label={`Open ${days.size} days a week`}>
                          {DAY_LETTERS.map((letter, day) => (
                            <span
                              key={letter}
                              className={
                                days.has(day)
                                  ? "rounded bg-primary/10 px-1 text-xs font-medium text-primary"
                                  : "px-1 text-xs text-muted-foreground/50"
                              }
                            >
                              {letter}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">Hours not set</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {resource.services.length ? (
                        <span className="line-clamp-2 text-sm">{resource.services.map((s) => s.name).join(", ")}</span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">Not linked to any option</span>
                      )}
                    </TableCell>
                    <TableCell>{resource.isActive ? "Active" : <span className="text-muted-foreground">Inactive</span>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="Nothing bookable yet"
          description="Add your rooms, rental units, tables or spaces, or staff such as tour guides, then link them to your booking options."
        />
      )}
    </>
  );
}
