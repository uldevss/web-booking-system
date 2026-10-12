import type { Metadata } from "next";
import Link from "next/link";
import { setProviderApproved } from "@/app/admin/actions";
import { ActionButton } from "@/components/action-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RatingSummary } from "@/components/rating-stars";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryLabel } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { providerRatings } from "@/lib/reviews";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Providers" };

export default async function AdminProvidersPage() {
  await requireUser(["ADMIN"]);
  const providers = await prisma.provider.findMany({
    include: {
      owner: { select: { name: true, email: true, phone: true } },
      _count: { select: { services: true, resources: true, bookings: true } },
    },
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
  });
  const ratings = await providerRatings(providers.map((p) => p.id));

  return (
    <>
      <PageHeader title="Providers" description="Approve new businesses before guests can see them." />
      {providers.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Options</TableHead>
                <TableHead className="text-right">Resources</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <Link href={`/providers/${provider.id}`} className="font-medium hover:underline">
                      {provider.businessName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">Joined {formatDate(provider.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    {provider.owner.name}
                    <span className="block text-xs text-muted-foreground">{provider.owner.email}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{categoryLabel(provider.category)}</TableCell>
                  <TableCell className="text-right tabular-nums">{provider._count.services}</TableCell>
                  <TableCell className="text-right tabular-nums">{provider._count.resources}</TableCell>
                  <TableCell className="text-right tabular-nums">{provider._count.bookings}</TableCell>
                  <TableCell>
                    <RatingSummary {...(ratings.get(provider.id) ?? { average: 0, count: 0 })} />
                  </TableCell>
                  <TableCell>
                    {provider.isApproved ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Approved</span>
                    ) : (
                      <span className="font-medium text-amber-700 dark:text-amber-400">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {provider.isApproved ? (
                      <ActionButton
                        size="sm"
                        variant="outline"
                        action={setProviderApproved.bind(null, provider.id, false)}
                        confirmText={`Suspend ${provider.businessName}? Its listings will be hidden from guests.`}
                      >
                        Suspend
                      </ActionButton>
                    ) : (
                      <ActionButton size="sm" action={setProviderApproved.bind(null, provider.id, true)}>
                        Approve
                      </ActionButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No providers yet" />
      )}
    </>
  );
}
