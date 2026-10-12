import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { guestsLabel, lengthLabel, priceLabel } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Booking options" };

export default async function ProviderServicesPage() {
  const { provider } = await requireProvider();
  const services = await prisma.service.findMany({
    where: { providerId: provider.id },
    include: { _count: { select: { resources: { where: { isActive: true } }, bookings: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Booking options"
        description="What guests can book: room types, tours, tables, escape games or venue packages, with prices and capacity."
        actions={
          <Button asChild>
            <Link href="/provider/services/new">
              <Plus aria-hidden />
              New option
            </Link>
          </Button>
        }
      />
      {services.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Option</TableHead>
                <TableHead>Booked as</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id} className="relative">
                  <TableCell>
                    <Link href={`/provider/services/${service.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {service.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {service._count.bookings} booking{service._count.bookings === 1 ? "" : "s"}
                    </span>
                  </TableCell>
                  <TableCell>{lengthLabel(service)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{priceLabel(service)}</TableCell>
                  <TableCell>{guestsLabel(service.maxGuests)}</TableCell>
                  <TableCell>
                    {service._count.resources ? (
                      service._count.resources
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">None linked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {service.isActive ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Bookable</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No booking options yet"
          description="Add what guests can book, such as a room type, a tour, a table size or a venue package."
          action={
            <Button asChild>
              <Link href="/provider/services/new">Add your first option</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
