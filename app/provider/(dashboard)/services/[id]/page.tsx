import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceForm } from "@/app/provider/(dashboard)/services/service-form";
import { PageHeader } from "@/components/page-header";
import { resourceName } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Edit booking option" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { provider } = await requireProvider();
  const { id } = await params;
  const [service, resources] = await Promise.all([
    prisma.service.findFirst({
      where: { id, providerId: provider.id },
      include: { resources: { select: { id: true } } },
    }),
    prisma.resource.findMany({
      where: { providerId: provider.id, isActive: true },
      select: { id: true, kind: true, name: true, user: { select: { name: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  if (!service) notFound();

  return (
    <>
      <PageHeader
        title={service.name}
        description={
          <Link href="/provider/services" className="text-primary hover:underline">
            ← Booking options
          </Link>
        }
      />
      <ServiceForm
        service={{
          id: service.id,
          name: service.name,
          description: service.description,
          bookingType: service.bookingType,
          pricingUnit: service.pricingUnit,
          price: service.price.toString(),
          durationMin: service.durationMin,
          maxGuests: service.maxGuests,
          checkInTime: service.checkInTime,
          checkOutTime: service.checkOutTime,
          isActive: service.isActive,
          resourceIds: service.resources.map((r) => r.id),
        }}
        resources={resources.map((r) => ({ id: r.id, kind: r.kind, name: resourceName(r) }))}
        defaultBookingType={service.bookingType}
      />
    </>
  );
}
