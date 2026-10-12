import type { BookingType, BusinessCategory, PricingUnit, ResourceKind } from "@/lib/generated/prisma/enums";
import { formatDuration, formatMoney } from "./format";

// Vocabulary of the marketplace: business categories, resource kinds and how
// options are priced. Safe to import from client components.

export const DEFAULT_CHECK_IN = "14:00";
export const DEFAULT_CHECK_OUT = "12:00";
/** Longest stay one booking can cover. */
export const MAX_NIGHTS = 30;

export type CategoryIcon = "hotel" | "rental" | "tour" | "escape" | "venue" | "restaurant";

export const categories: {
  key: BusinessCategory;
  label: string;
  singular: string;
  icon: CategoryIcon;
  blurb: string;
}[] = [
  { key: "HOTEL", label: "Hotels", singular: "Hotel", icon: "hotel", blurb: "Rooms and suites by the night" },
  { key: "SHORT_TERM_RENTAL", label: "Short-term rentals", singular: "Short-term rental", icon: "rental", blurb: "Cabins, condos and whole homes" },
  { key: "TOUR_OPERATOR", label: "Tours", singular: "Tour operator", icon: "tour", blurb: "Guided tours and day trips" },
  { key: "ESCAPE_ROOM", label: "Escape rooms", singular: "Escape room", icon: "escape", blurb: "Puzzle rooms for friends and teams" },
  { key: "EVENT_VENUE", label: "Event venues", singular: "Event venue", icon: "venue", blurb: "Gardens, halls and function rooms" },
  { key: "RESTAURANT", label: "Restaurants", singular: "Restaurant", icon: "restaurant", blurb: "Table reservations" },
];

export function isCategory(value: unknown): value is BusinessCategory {
  return categories.some((category) => category.key === value);
}

export function categoryLabel(key: BusinessCategory) {
  return categories.find((category) => category.key === key)?.singular ?? key;
}

export const resourceKinds: Record<ResourceKind, { label: string; plural: string }> = {
  STAFF: { label: "Staff member", plural: "Staff" },
  ROOM: { label: "Room", plural: "Rooms" },
  UNIT: { label: "Rental unit", plural: "Rental units" },
  TABLE: { label: "Table", plural: "Tables" },
  SPACE: { label: "Space", plural: "Spaces" },
};

/** Rooms and units are named ("Room 1201"); staff resources use the person's name. */
export function resourceName(resource: { name: string | null; user?: { name: string } | null }) {
  return resource.name ?? resource.user?.name ?? "Unnamed";
}

type Priced = { pricingUnit: PricingUnit; price: number | string | { toString(): string } };

export const pricingLabels: Record<PricingUnit, string> = {
  PER_BOOKING: "per booking",
  PER_PERSON: "per person",
  PER_NIGHT: "per night",
};

/** "₱4,500.00 / night", "₱650.00 / person", "₱35,000.00", or "Free". */
export function priceLabel(service: Priced) {
  if (Number(service.price.toString()) === 0) return "Free";
  const amount = formatMoney(service.price);
  if (service.pricingUnit === "PER_NIGHT") return `${amount} / night`;
  if (service.pricingUnit === "PER_PERSON") return `${amount} / person`;
  return amount;
}

/** What a booking costs; the server stores this as the agreed price. */
export function bookingTotal(service: Priced, guests: number, nights: number) {
  const price = Number(service.price.toString());
  const total =
    service.pricingUnit === "PER_NIGHT" ? price * nights : service.pricingUnit === "PER_PERSON" ? price * guests : price;
  return Math.round(total * 100) / 100;
}

/** The upfront amount for a plan: the deposit share of the total, or all of it. */
export function amountDueFor(total: number, plan: "DEPOSIT" | "FULL", depositPercent: number) {
  if (plan === "FULL") return total;
  return Math.round(total * depositPercent) / 100;
}

export function lengthLabel(service: { bookingType: BookingType; durationMin: number | null }) {
  return service.bookingType === "NIGHTLY" ? "Overnight stay" : formatDuration(service.durationMin ?? 0);
}

export function guestsLabel(maxGuests: number) {
  return maxGuests === 1 ? "1 guest" : `Up to ${maxGuests} guests`;
}

/** Whole nights between check-in and check-out. */
export function nightsBetween(startAt: Date, endAt: Date) {
  return Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 86_400_000));
}
