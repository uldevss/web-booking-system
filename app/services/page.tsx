import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryFilter } from "@/components/category";
import { EmptyState, PageHeader } from "@/components/page-header";
import { SearchBox } from "@/components/search-box";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { categories, isCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { providerRatings } from "@/lib/reviews";
import { flattenParams, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Browse" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = flattenParams(await searchParams);
  const q = params.q?.trim().slice(0, 100) ?? "";
  const category = isCategory(params.category) ? params.category : undefined;
  const categoryMeta = categories.find((c) => c.key === category);

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      provider: { isApproved: true, ...(category ? { category } : {}) },
      resources: { some: { isActive: true } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { provider: { businessName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { provider: { select: { id: true, businessName: true, address: true, category: true } } },
    orderBy: [{ provider: { businessName: "asc" } }, { name: "asc" }],
    take: 60,
  });
  const ratings = await providerRatings([...new Set(services.map((service) => service.providerId))]);

  const count = `${services.length} result${services.length === 1 ? "" : "s"}`;
  const description = q
    ? `${count} for “${q}”${categoryMeta ? ` in ${categoryMeta.label.toLowerCase()}` : ""}`
    : categoryMeta
      ? categoryMeta.blurb
      : "Rooms, stays, tours, escape rooms, venues and tables you can book right now.";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <PageHeader title={categoryMeta?.label ?? "Browse"} description={description} />
      <form className="mb-4 flex max-w-lg gap-2" role="search">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <label htmlFor="service-search" className="sr-only">
          Search
        </label>
        <SearchBox scope="catalog" id="service-search" name="q" defaultValue={q} placeholder="Search by name, description or business" />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Search
        </Button>
      </form>
      <div className="mb-8">
        <CategoryFilter basePath="/services" active={category} query={{ q }} />
      </div>

      {services.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              rating={ratings.get(service.providerId) ?? { average: 0, count: 0 }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing found"
          description={q || category ? "Try a different word or category." : "Nothing is listed yet."}
          action={
            q || category ? (
              <Button asChild variant="outline">
                <Link href="/services">Show everything</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
