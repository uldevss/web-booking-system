import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { reportFilterFromParams, ReportView } from "@/components/reports/report-view";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ProviderReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { provider } = await requireProvider();
  // The provider filter is forced to this business, whatever the URL says.
  const filter = { ...reportFilterFromParams(flattenParams(await searchParams)), providerId: provider.id };
  return (
    <>
      <PageHeader title="Reports" description="Revenue, bookings, top options and how busy each room, space and staff member is." />
      <ReportView filter={filter} exportBase="/api/reports/export" />
    </>
  );
}
