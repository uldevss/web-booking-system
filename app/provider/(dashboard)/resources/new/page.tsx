import type { Metadata } from "next";
import Link from "next/link";
import { ResourceCreateForm, StaffCreateForm } from "@/app/provider/(dashboard)/resources/resource-forms";
import { PageHeader } from "@/components/page-header";
import type { BusinessCategory } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireProvider } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Add staff or resource" };

/** The resource type most businesses of each category add first. */
const defaultKind: Record<BusinessCategory, string> = {
  HOTEL: "ROOM",
  SHORT_TERM_RENTAL: "UNIT",
  TOUR_OPERATOR: "SPACE",
  ESCAPE_ROOM: "SPACE",
  EVENT_VENUE: "SPACE",
  RESTAURANT: "TABLE",
};

export default async function NewResourcePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { provider } = await requireProvider();
  const isStaff = flattenParams(await searchParams).type === "staff";
  const services = await prisma.service.findMany({
    where: { providerId: provider.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title={isStaff ? "Add a staff member" : "Add a room, table or space"}
        description={
          <Link href="/provider/resources" className="text-primary hover:underline">
            ← Staff & resources
          </Link>
        }
      />
      <nav aria-label="What to add" className="mb-6 flex gap-1 border-b">
        {[
          { href: "/provider/resources/new", label: "Room, unit, table or space", active: !isStaff },
          { href: "/provider/resources/new?type=staff", label: "Staff member (with login)", active: isStaff },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {isStaff ? (
        <StaffCreateForm services={services} />
      ) : (
        <ResourceCreateForm services={services} defaultKind={defaultKind[provider.category]} />
      )}
    </>
  );
}
