import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { reportFilterFromParams, ReportView } from "@/components/reports/report-view";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser(["ADMIN"]);
  const filter = reportFilterFromParams(flattenParams(await searchParams));
  const [customers, providers, pendingProviders, resources] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.provider.count({ where: { isApproved: true } }),
    prisma.provider.findMany({ where: { isApproved: false }, select: { id: true } }),
    prisma.resource.count({ where: { isActive: true } }),
  ]);
  const providerOptions = await prisma.provider.findMany({
    select: { id: true, businessName: true },
    orderBy: { businessName: "asc" },
  });

  return (
    <>
      <PageHeader title="Platform overview" description="All businesses, or one at a time." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Guests" value={customers.toLocaleString()} />
        <StatCard label="Listed businesses" value={providers} />
        <StatCard
          label="Awaiting approval"
          value={pendingProviders.length}
          hint={
            pendingProviders.length ? (
              <Link href="/admin/providers" className="text-primary hover:underline">
                Review businesses
              </Link>
            ) : undefined
          }
        />
        <StatCard label="Bookable rooms, tables & staff" value={resources} />
      </div>
      <ReportView
        filter={filter}
        exportBase="/api/reports/export"
        providers={providerOptions.map((p) => ({ id: p.id, name: p.businessName }))}
        showProviderColumn={!filter.providerId}
      />
    </>
  );
}
