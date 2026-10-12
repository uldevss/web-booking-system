import { Clock, MapPin, Moon, Users } from "lucide-react";
import Link from "next/link";
import { CategoryBadge } from "@/components/category";
import { RatingSummary } from "@/components/rating-stars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { guestsLabel, lengthLabel, priceLabel } from "@/lib/catalog";
import type { BookingType, BusinessCategory, PricingUnit } from "@/lib/generated/prisma/enums";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    description: string | null;
    bookingType: BookingType;
    pricingUnit: PricingUnit;
    durationMin: number | null;
    maxGuests: number;
    price: { toString(): string };
    provider: { id: string; businessName: string; address: string | null; category: BusinessCategory };
  };
  rating: { average: number; count: number };
  showProvider?: boolean;
};

export function ServiceCard({ service, rating, showProvider = true }: ServiceCardProps) {
  const nightly = service.bookingType === "NIGHTLY";
  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-1">
        {showProvider ? <CategoryBadge category={service.provider.category} /> : null}
        <CardTitle className="text-base">{service.name}</CardTitle>
        {showProvider ? (
          <div className="flex flex-col gap-1 text-sm">
            <Link href={`/providers/${service.provider.id}`} className="font-medium text-primary hover:underline">
              {service.provider.businessName}
            </Link>
            <RatingSummary average={rating.average} count={rating.count} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        {service.description ? <p className="line-clamp-2 text-muted-foreground">{service.description}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {nightly ? <Moon aria-hidden className="size-4" /> : <Clock aria-hidden className="size-4" />}
            {lengthLabel(service)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden className="size-4" />
            {guestsLabel(service.maxGuests)}
          </span>
          {showProvider && service.provider.address ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-4" />
              {service.provider.address}
            </span>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{priceLabel(service)}</span>
        <Button asChild size="sm">
          <Link href={`/book/${service.id}`}>{nightly ? "Check dates" : "Book"}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
