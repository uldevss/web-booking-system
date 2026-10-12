import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { categoryLabel, guestsLabel, lengthLabel, MAX_NIGHTS, priceLabel } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { gcashDetails, getPlatformSettings } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/session";
import { isDayKey } from "@/lib/time";

type Props = {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<SearchParams>;
};

export const metadata: Metadata = { title: "Book" };

const toInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
};

export default async function BookPage({ params, searchParams }: Props) {
  const { serviceId } = await params;
  const query = flattenParams(await searchParams);
  const [service, user, settings] = await Promise.all([
    prisma.service.findFirst({
      where: { id: serviceId, isActive: true, provider: { isApproved: true } },
      include: { provider: { select: { id: true, businessName: true, address: true, category: true } } },
    }),
    getCurrentUser(),
    getPlatformSettings(),
  ]);
  if (!service) notFound();

  // Choices carried through the login redirect, if they look valid.
  const start = query.start && !Number.isNaN(Date.parse(query.start)) ? new Date(query.start).toISOString() : null;
  const checkIn = query.checkIn && isDayKey(query.checkIn) ? query.checkIn : null;
  const viewer = !user ? "guest" : user.role === "CUSTOMER" ? "customer" : "other";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="mb-6">
        <Link href={`/providers/${service.provider.id}`} className="text-sm text-primary hover:underline">
          {service.provider.businessName}
        </Link>
        <span className="text-sm text-muted-foreground"> · {categoryLabel(service.provider.category)}</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Book {service.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lengthLabel(service)} · {guestsLabel(service.maxGuests)} · {priceLabel(service)}
        </p>
        {service.description ? <p className="mt-3 max-w-2xl text-sm text-pretty">{service.description}</p> : null}
      </div>
      <BookingFlow
        service={{
          id: service.id,
          name: service.name,
          bookingType: service.bookingType,
          pricingUnit: service.pricingUnit,
          price: service.price.toString(),
          durationMin: service.durationMin,
          maxGuests: service.maxGuests,
          provider: { businessName: service.provider.businessName, address: service.provider.address },
        }}
        depositPercent={siteConfig.depositPercent}
        gcash={gcashDetails(settings)}
        viewer={viewer}
        initial={{
          start: service.bookingType === "TIMED" ? start : null,
          checkIn: service.bookingType === "NIGHTLY" ? checkIn : null,
          nights: toInt(query.nights, 1, MAX_NIGHTS),
          guests: toInt(query.guests, Math.min(2, service.maxGuests), service.maxGuests),
        }}
      />
    </div>
  );
}
