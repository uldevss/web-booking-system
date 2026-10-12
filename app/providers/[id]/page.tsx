import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/category";
import { EmptyState } from "@/components/page-header";
import { RatingStars, RatingSummary } from "@/components/rating-stars";
import { ServiceCard } from "@/components/service-card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { providerRating } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = await prisma.provider.findUnique({ where: { id: (await params).id }, select: { businessName: true } });
  return { title: provider?.businessName ?? "Business" };
}

export default async function ProviderPage({ params }: Props) {
  const { id } = await params;
  const [provider, viewer] = await Promise.all([
    prisma.provider.findUnique({
      where: { id },
      include: {
        services: {
          where: { isActive: true, resources: { some: { isActive: true } } },
          orderBy: { name: "asc" },
          include: { provider: { select: { id: true, businessName: true, address: true, category: true } } },
        },
      },
    }),
    getCurrentUser(),
  ]);
  // Unapproved businesses are visible only to their owner and admins.
  const canPreview = viewer && (viewer.role === "ADMIN" || viewer.id === provider?.ownerId);
  if (!provider || (!provider.isApproved && !canPreview)) notFound();

  const [rating, reviews] = await Promise.all([
    providerRating(provider.id),
    prisma.review.findMany({
      where: { isHidden: false, booking: { providerId: provider.id } },
      include: { customer: { select: { name: true } }, booking: { select: { service: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      {!provider.isApproved ? (
        <p className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Preview: this business is waiting for admin approval and isn&apos;t visible to guests yet.
        </p>
      ) : null}

      <header className="mb-8">
        <CategoryBadge category={provider.category} className="mb-2" />
        <h1 className="text-3xl font-semibold tracking-tight">{provider.businessName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <RatingSummary average={rating.average} count={rating.count} />
          {provider.address ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-4" />
              {provider.address}
            </span>
          ) : null}
        </div>
        {provider.description ? <p className="mt-4 max-w-2xl text-pretty">{provider.description}</p> : null}
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">What you can book</h2>
        {provider.services.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {provider.services.map((service) => (
              <ServiceCard key={service.id} service={service} rating={rating} showProvider={false} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing bookable yet" description="This business hasn't set up rooms, tables, spaces or staff yet." />
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Reviews</h2>
        {reviews.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <RatingStars value={review.rating} />
                  <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                </div>
                {review.comment ? <p className="mt-2 text-sm">{review.comment}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {review.customer.name.split(" ")[0]} · {review.booking.service.name}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
      </section>
    </div>
  );
}
