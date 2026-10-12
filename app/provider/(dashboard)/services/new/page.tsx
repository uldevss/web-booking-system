import type { Metadata } from "next";
import Link from "next/link";
import { ServiceForm } from "@/app/provider/(dashboard)/services/service-form";
import { PageHeader } from "@/components/page-header";
import { resourceName } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "New booking option" };

export default async function NewServicePage() {
  const { provider } = await requireProvider();
  const resources = await prisma.resource.findMany({
    where: { providerId: provider.id, isActive: true },
    select: { id: true, kind: true, name: true, user: { select: { name: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }, { createdAt: "asc" }],
  });
  const lodging = provider.category === "HOTEL" || provider.category === "SHORT_TERM_RENTAL";

  return (
    <>
      <PageHeader
        title="New booking option"
        description={
          <Link href="/provider/services" className="text-primary hover:underline">
            ← Booking options
          </Link>
        }
      />
      <ServiceForm
        resources={resources.map((r) => ({ id: r.id, kind: r.kind, name: resourceName(r) }))}
        defaultBookingType={lodging ? "NIGHTLY" : "TIMED"}
      />
    </>
  );
}
