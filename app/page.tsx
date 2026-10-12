import { ArrowRight, CalendarCheck, Search, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { CategoryGlyph } from "@/components/category";
import { SearchBox } from "@/components/search-box";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { categories } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { providerRatings } from "@/lib/reviews";

export default async function HomePage() {
  const [services, counts] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true, provider: { isApproved: true }, resources: { some: { isActive: true } } },
      include: {
        provider: { select: { id: true, businessName: true, address: true, category: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { bookings: { _count: "desc" } },
      take: 6,
    }),
    prisma.provider.groupBy({ by: ["category"], where: { isApproved: true }, _count: { _all: true } }),
  ]);
  const ratings = await providerRatings([...new Set(services.map((service) => service.providerId))]);
  const countFor = (key: string) => counts.find((row) => row.category === key)?._count._all ?? 0;

  return (
    <div>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 lg:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Stays, tours, tables and venues, booked in one place
            </h1>
            <p className="mt-4 text-lg text-muted-foreground text-pretty">
              Hotels, short-term rentals, tour operators, escape rooms, event venues and restaurants with real-time
              availability and instant booking requests.
            </p>
            <form action="/services" className="mt-8 flex max-w-lg gap-2">
              <label htmlFor="home-search" className="sr-only">
                Search
              </label>
              <SearchBox scope="catalog" id="home-search" name="q" placeholder="Try “island hopping” or “suite”" className="h-11 bg-background" />
              <Button type="submit" size="lg" className="h-11">
                <Search aria-hidden />
                Search
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Browse by category</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.key}
              href={`/services?category=${category.key}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CategoryGlyph category={category.key} className="size-6 text-primary" />
              <p className="mt-3 font-medium">{category.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{category.blurb}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {countFor(category.key)} business{countFor(category.key) === 1 ? "" : "es"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 lg:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Popular right now</h2>
          <Link href="/services" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Browse all <ArrowRight aria-hidden className="size-4" />
          </Link>
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
          <p className="text-muted-foreground">Nothing is listed yet. Check back soon.</p>
        )}
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 lg:px-6">
          {[
            { icon: Search, title: "Find what you need", text: "Compare rooms, tours, tables and venues by price, capacity and reviews." },
            { icon: CalendarCheck, title: "Pick dates or a time", text: "Only genuinely free rooms, tables and slots are shown: no double bookings." },
            { icon: Star, title: "Enjoy, then review", text: "Pay the business directly, then rate your experience to help other guests." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon aria-hidden className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <ShieldCheck aria-hidden className="mt-1 size-8 shrink-0 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Run a hotel, rental, tour, venue or restaurant?</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                List it on {siteConfig.name}: manage rooms, tables, spaces and staff, take bookings without double booking,
                track payments and see reports in one place.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href="/provider/register">List your business</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
