import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBadge, CategoryFilter } from "@/components/category";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RatingSummary } from "@/components/rating-stars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categories, isCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { providerRatings } from "@/lib/reviews";
import { flattenParams, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Businesses" };

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = flattenParams(await searchParams);
  const category = isCategory(params.category) ? params.category : undefined;
  const categoryMeta = categories.find((c) => c.key === category);

  const providers = await prisma.provider.findMany({
    where: { isApproved: true, ...(category ? { category } : {}) },
    include: { _count: { select: { services: { where: { isActive: true } } } } },
    orderBy: { businessName: "asc" },
  });
  const ratings = await providerRatings(providers.map((provider) => provider.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <PageHeader
        title={categoryMeta?.label ?? "Businesses"}
        description={
          categoryMeta?.blurb ?? "Hotels, rentals, tour operators, escape rooms, venues and restaurants, all bookable online."
        }
      />
      <div className="mb-8">
        <CategoryFilter basePath="/providers" active={category} />
      </div>
      {providers.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Link
              key={provider.id}
              href={`/providers/${provider.id}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader className="gap-1">
                  <CategoryBadge category={provider.category} />
                  <CardTitle className="text-base">{provider.businessName}</CardTitle>
                  <RatingSummary {...(ratings.get(provider.id) ?? { average: 0, count: 0 })} />
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {provider.description ? <p className="line-clamp-2">{provider.description}</p> : null}
                  {provider.address ? (
                    <p className="flex items-center gap-1">
                      <MapPin aria-hidden className="size-4 shrink-0" />
                      {provider.address}
                    </p>
                  ) : null}
                  <p>
                    {provider._count.services} booking option{provider._count.services === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No businesses yet" description="Approved businesses will appear here." />
      )}
    </div>
  );
}
