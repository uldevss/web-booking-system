// Demo data for the hospitality, travel & events marketplace: an admin, one
// approved business per category (hotel, short-term rental, tour operator,
// escape room, event venue, restaurant) with rooms / units / tables / spaces /
// staff and booking options, one business awaiting approval, guests, and about
// six weeks of bookings with payments and reviews so every dashboard has
// something to show.
//
//   npm run db:seed          (skips if the demo admin already exists)
//   npx prisma migrate reset (wipes the database, migrates and reseeds)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type BookingStatus,
  type BookingType,
  type BusinessCategory,
  type PaymentMethod,
  type PricingUnit,
  type ResourceKind,
} from "../lib/generated/prisma/client";
import { bookingTotal, DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT } from "../lib/catalog";
import { addDays, dayOfWeek, timeToMinutes, toDayKey, zonedTimeToUtc } from "../lib/time";
import { demoGcashQr } from "../lib/demo-qr";

/** Every demo account signs in with this password. */
const DEMO_PASSWORD = "Password123!";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila";

// Small deterministic random generator so the demo data is the same every run.
let seed = 20261002;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

type Shift = [day: number, start: string, end: string];
const everyDay = (start: string, end: string): Shift[] => [0, 1, 2, 3, 4, 5, 6].map((d) => [d, start, end]);
const days = (list: number[], start: string, end: string): Shift[] => list.map((d) => [d, start, end]);

type OptionInput = {
  name: string;
  description: string;
  bookingType: BookingType;
  pricingUnit: PricingUnit;
  price: string;
  durationMin?: number;
  maxGuests: number;
  checkInTime?: string;
  checkOutTime?: string;
};

type ResourceInput = {
  kind: ResourceKind;
  /** Rooms, units, tables and spaces have a name; staff get an account instead. */
  name?: string;
  staff?: { name: string; email: string };
  shifts: Shift[];
  /** Option names this resource can be booked for. */
  options: string[];
};

async function main() {
  if (await prisma.user.findUnique({ where: { email: "admin@example.com" } })) {
    console.log("Demo data already exists (admin@example.com). Run `npx prisma migrate reset` to start over.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = (name: string, email: string, role: "CUSTOMER" | "PROVIDER" | "EMPLOYEE" | "ADMIN", phone?: string) =>
    prisma.user.create({ data: { name, email, role, phone, passwordHash, emailVerifiedAt: new Date() } });

  await user("Platform Admin", "admin@example.com", "ADMIN");

  // Where guests pay: the platform's GCash account (demo QR) and its commission.
  const gcashName = "Booking System Payments";
  const gcashNumber = "0917 123 4567";
  await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: { gcashName, gcashNumber, gcashQrUrl: await demoGcashQr(gcashName, gcashNumber), commissionPercent: 5 },
    create: { id: "default", gcashName, gcashNumber, gcashQrUrl: await demoGcashQr(gcashName, gcashNumber), commissionPercent: 5 },
  });

  const guests = await Promise.all([
    user("Juan Dela Cruz", "customer@example.com", "CUSTOMER", "0917 555 0101"),
    user("Ana Reyes", "ana.reyes@example.com", "CUSTOMER", "0917 555 0102"),
    user("Carlo Santos", "carlo.santos@example.com", "CUSTOMER", "0917 555 0103"),
    user("Bea Lim", "bea.lim@example.com", "CUSTOMER", "0917 555 0104"),
    user("Miguel Tan", "miguel.tan@example.com", "CUSTOMER", "0917 555 0105"),
    user("Sofia Cruz", "sofia.cruz@example.com", "CUSTOMER", "0917 555 0106"),
  ]);

  // ── Businesses ─────────────────────────────────────────────────────────────

  let staffCounter = 0;

  async function business(input: {
    owner: [name: string, email: string];
    businessName: string;
    category: BusinessCategory;
    address: string;
    description: string;
    isApproved: boolean;
    paymentInstructions?: string;
    options: OptionInput[];
    resources: ResourceInput[];
  }) {
    const owner = await user(input.owner[0], input.owner[1], "PROVIDER", `0918 555 02${String(staffCounter++).padStart(2, "0")}`);
    const created = await prisma.provider.create({
      data: {
        ownerId: owner.id,
        businessName: input.businessName,
        category: input.category,
        address: input.address,
        description: input.description,
        paymentInstructions: input.paymentInstructions ?? "GCash: 0917 555 0100 (business owner). Please send the deposit and enter the reference number.",
        isApproved: input.isApproved,
      },
    });

    const options = new Map<string, OptionInput & { id: string }>();
    for (const option of input.options) {
      const service = await prisma.service.create({
        data: {
          providerId: created.id,
          name: option.name,
          description: option.description,
          bookingType: option.bookingType,
          pricingUnit: option.pricingUnit,
          price: option.price,
          durationMin: option.bookingType === "TIMED" ? option.durationMin : null,
          maxGuests: option.maxGuests,
          checkInTime: option.bookingType === "NIGHTLY" ? (option.checkInTime ?? DEFAULT_CHECK_IN) : null,
          checkOutTime: option.bookingType === "NIGHTLY" ? (option.checkOutTime ?? DEFAULT_CHECK_OUT) : null,
        },
      });
      options.set(option.name, { ...option, id: service.id });
    }

    const resources = [];
    for (const r of input.resources) {
      const account = r.staff ? await user(r.staff.name, r.staff.email, "EMPLOYEE", `0919 555 03${String(staffCounter++).padStart(2, "0")}`) : null;
      const resource = await prisma.resource.create({
        data: {
          providerId: created.id,
          kind: r.kind,
          name: r.name ?? null,
          userId: account?.id ?? null,
          services: { connect: r.options.map((name) => ({ id: options.get(name)!.id })) },
          schedules: { create: r.shifts.map(([dayOfWeek, startTime, endTime]) => ({ dayOfWeek, startTime, endTime })) },
        },
      });
      resources.push({ id: resource.id, shifts: r.shifts, options: r.options });
    }
    return { provider: created, owner, options, resources };
  }
  type Business = Awaited<ReturnType<typeof business>>;

  const hotel = await business({
    owner: ["Liza Mendoza", "provider@example.com"],
    businessName: "Harbor View Hotel",
    category: "HOTEL",
    address: "Roxas Boulevard, Manila",
    description: "A 48-room bayside hotel with sunset views, a rooftop pool and complimentary breakfast.",
    isApproved: true,
    options: [
      { name: "Deluxe King Room", description: "32 sqm, king bed, city view, breakfast for two.", bookingType: "NIGHTLY", pricingUnit: "PER_NIGHT", price: "4500", maxGuests: 2 },
      { name: "Family Suite", description: "Two bedrooms, living area and a bay-facing balcony.", bookingType: "NIGHTLY", pricingUnit: "PER_NIGHT", price: "8900", maxGuests: 4 },
      { name: "Day-use Room (6 hours)", description: "Rest, shower and work between flights.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "2200", durationMin: 360, maxGuests: 2 },
      { name: "Airport Transfer", description: "Private van to or from NAIA with our concierge.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "1500", durationMin: 60, maxGuests: 4 },
    ],
    resources: [
      // Hours only matter for timed options (day use); overnight stays ignore them.
      ...["1201", "1202", "1203", "1204"].map((n): ResourceInput => ({ kind: "ROOM", name: `Room ${n}`, shifts: everyDay("08:00", "20:00"), options: ["Deluxe King Room", "Day-use Room (6 hours)"] })),
      ...["1501", "1502"].map((n): ResourceInput => ({ kind: "ROOM", name: `Suite ${n}`, shifts: everyDay("00:00", "23:59"), options: ["Family Suite"] })),
      { kind: "STAFF", staff: { name: "Maria Santos", email: "employee@example.com" }, shifts: everyDay("07:00", "22:00"), options: ["Airport Transfer"] },
    ],
  });

  const rental = await business({
    owner: ["Paolo Villanueva", "rental@example.com"],
    businessName: "Casa Verde Tagaytay",
    category: "SHORT_TERM_RENTAL",
    address: "Tagaytay City, Cavite",
    description: "Three private cabins on a ridge above Taal Lake, each with a kitchen, deck and firepit.",
    isApproved: true,
    options: [
      { name: "Lakeview Cabin", description: "One bedroom, queen bed, outdoor shower and lake view.", bookingType: "NIGHTLY", pricingUnit: "PER_NIGHT", price: "6500", maxGuests: 3, checkInTime: "15:00", checkOutTime: "11:00" },
      { name: "Family Cabin", description: "Two bedrooms, full kitchen, bunk beds for the kids.", bookingType: "NIGHTLY", pricingUnit: "PER_NIGHT", price: "9800", maxGuests: 6, checkInTime: "15:00", checkOutTime: "11:00" },
    ],
    resources: [
      { kind: "UNIT", name: "Cabin A", shifts: everyDay("00:00", "23:59"), options: ["Lakeview Cabin"] },
      { kind: "UNIT", name: "Cabin B", shifts: everyDay("00:00", "23:59"), options: ["Lakeview Cabin"] },
      { kind: "UNIT", name: "Cabin C", shifts: everyDay("00:00", "23:59"), options: ["Family Cabin"] },
    ],
  });

  const tours = await business({
    owner: ["Rico Abad", "tours@example.com"],
    businessName: "Island Hop Palawan",
    category: "TOUR_OPERATOR",
    address: "El Nido, Palawan",
    description: "Small-group boat tours and kayaking trips run by local guides.",
    isApproved: true,
    options: [
      { name: "Island Hopping Tour A", description: "Big Lagoon, Secret Lagoon and Shimizu Island, lunch included.", bookingType: "TIMED", pricingUnit: "PER_PERSON", price: "1400", durationMin: 480, maxGuests: 12 },
      { name: "Sunset Kayak Trip", description: "Two hours of paddling through the mangroves at golden hour.", bookingType: "TIMED", pricingUnit: "PER_PERSON", price: "850", durationMin: 120, maxGuests: 6 },
      { name: "Private Boat Charter", description: "Your own boat and guide for the day.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "9500", durationMin: 480, maxGuests: 8 },
    ],
    resources: [
      { kind: "STAFF", staff: { name: "Kuya Dan Sabando", email: "dan.sabando@example.com" }, shifts: everyDay("06:00", "19:00"), options: ["Island Hopping Tour A", "Private Boat Charter"] },
      { kind: "STAFF", staff: { name: "Len Magbanua", email: "len.magbanua@example.com" }, shifts: days([1, 2, 3, 4, 5, 6], "06:00", "19:00"), options: ["Island Hopping Tour A", "Sunset Kayak Trip"] },
    ],
  });

  const escape = await business({
    owner: ["Trisha Go", "escape@example.com"],
    businessName: "Lockdown Escape Rooms",
    category: "ESCAPE_ROOM",
    address: "Bonifacio Global City, Taguig",
    description: "Three themed rooms with live game masters. Great for birthdays and team building.",
    isApproved: true,
    options: [
      { name: "The Heist (60 min)", description: "Crack the vault before the guards return.", bookingType: "TIMED", pricingUnit: "PER_PERSON", price: "550", durationMin: 60, maxGuests: 6 },
      { name: "Haunted Manor (60 min)", description: "A spooky room for brave groups.", bookingType: "TIMED", pricingUnit: "PER_PERSON", price: "550", durationMin: 60, maxGuests: 8 },
      { name: "Team Building Package (90 min)", description: "Two rooms back to back plus a debrief.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "6500", durationMin: 90, maxGuests: 12 },
    ],
    resources: [
      { kind: "SPACE", name: "Heist Room", shifts: everyDay("11:00", "22:00"), options: ["The Heist (60 min)", "Team Building Package (90 min)"] },
      { kind: "SPACE", name: "Manor Room", shifts: everyDay("11:00", "22:00"), options: ["Haunted Manor (60 min)", "Team Building Package (90 min)"] },
    ],
  });

  const venue = await business({
    owner: ["Hannah Ocampo", "venue@example.com"],
    businessName: "The Glass Pavilion",
    category: "EVENT_VENUE",
    address: "Antipolo, Rizal",
    description: "A garden events venue with a glass pavilion, a ballroom and in-house catering partners.",
    isApproved: true,
    options: [
      { name: "Garden Pavilion (6 hours)", description: "Seats 150. Tables, chairs and sound system included.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "45000", durationMin: 360, maxGuests: 150 },
      { name: "Ballroom (6 hours)", description: "Air-conditioned hall for up to 300 guests.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "75000", durationMin: 360, maxGuests: 300 },
      { name: "Meeting Room (4 hours)", description: "Boardroom for 20 with projector and coffee.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "6000", durationMin: 240, maxGuests: 20 },
    ],
    resources: [
      { kind: "SPACE", name: "Garden Pavilion", shifts: everyDay("08:00", "23:00"), options: ["Garden Pavilion (6 hours)"] },
      { kind: "SPACE", name: "Grand Ballroom", shifts: everyDay("08:00", "23:00"), options: ["Ballroom (6 hours)"] },
      { kind: "SPACE", name: "Boardroom", shifts: days([1, 2, 3, 4, 5], "08:00", "20:00"), options: ["Meeting Room (4 hours)"] },
    ],
  });

  const restaurant = await business({
    owner: ["Chef Marco Dizon", "restaurant@example.com"],
    businessName: "Dizon's Kitchen",
    category: "RESTAURANT",
    address: "Maginhawa St, Quezon City",
    description: "Modern Filipino comfort food. Reserve a table for lunch or dinner.",
    isApproved: true,
    options: [
      { name: "Table for 2 (90 min)", description: "A cozy table for two.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "0", durationMin: 90, maxGuests: 2 },
      { name: "Table for 4 (90 min)", description: "A table for up to four.", bookingType: "TIMED", pricingUnit: "PER_BOOKING", price: "0", durationMin: 90, maxGuests: 4 },
      { name: "Chef's Tasting Menu (2 hours)", description: "Seven courses at the chef's counter, prepaid.", bookingType: "TIMED", pricingUnit: "PER_PERSON", price: "2800", durationMin: 120, maxGuests: 6 },
    ],
    resources: [
      ...["1", "2", "3", "4"].map((n): ResourceInput => ({ kind: "TABLE", name: `Table ${n}`, shifts: days([2, 3, 4, 5, 6, 0], "11:00", "22:00"), options: ["Table for 2 (90 min)"] })),
      ...["5", "6", "7"].map((n): ResourceInput => ({ kind: "TABLE", name: `Table ${n}`, shifts: days([2, 3, 4, 5, 6, 0], "11:00", "22:00"), options: ["Table for 4 (90 min)"] })),
      { kind: "TABLE", name: "Chef's Counter", shifts: days([4, 5, 6], "18:00", "22:00"), options: ["Chef's Tasting Menu (2 hours)"] },
    ],
  });

  await business({
    owner: ["Nina Bautista", "pending@example.com"],
    businessName: "Cloud 9 Surf Hostel",
    category: "HOTEL",
    address: "General Luna, Siargao",
    description: "Dorm beds and private rooms steps from the surf.",
    isApproved: false,
    options: [{ name: "Private Room", description: "Double bed, fan, shared bathroom.", bookingType: "NIGHTLY", pricingUnit: "PER_NIGHT", price: "1500", maxGuests: 2 }],
    resources: [{ kind: "ROOM", name: "Room 1", shifts: everyDay("00:00", "23:59"), options: ["Private Room"] }],
  });

  // ── Bookings ───────────────────────────────────────────────────────────────

  const now = new Date();
  const today = toDayKey(now, TZ);
  const comments = [
    "Lovely place and very accommodating staff. Will come back!",
    "Everything was ready on time. Highly recommended.",
    "Good overall, check-in took a little while.",
    "Loved it, thank you!",
    "Clean, well kept and exactly as described.",
    undefined,
  ];
  let created = 0;

  async function createBooking(
    biz: Business,
    resourceId: string,
    option: OptionInput & { id: string },
    startAt: Date,
    endAt: Date,
    nights: number,
  ) {
    const past = endAt <= now;
    const roll = random();
    const status: BookingStatus = past
      ? roll < 0.78 ? "COMPLETED" : roll < 0.9 ? "CANCELLED" : "NO_SHOW"
      : roll < 0.65 ? "CONFIRMED" : roll < 0.9 ? "PENDING" : "CANCELLED";
    const guest = pick(guests);
    const guestsCount = between(1, Math.min(option.maxGuests, 6));
    const total = String(bookingTotal(option, guestsCount, nights));
    const method = pick<PaymentMethod>(["CASH", "GCASH", "GCASH", "CARD", "BANK"]);
    const paid = random();
    const free = Number(total) === 0;

    await prisma.booking.create({
      data: {
        customerId: guest.id,
        providerId: biz.provider.id,
        serviceId: option.id,
        resourceId,
        startAt,
        endAt,
        guests: guestsCount,
        status,
        priceAtBooking: total,
        cancelledAt: status === "CANCELLED" ? new Date(startAt.getTime() - 26 * 3_600_000) : null,
        reminderSentAt: past ? startAt : null,
        // Requested 2-21 days before the start, but never in the future.
        createdAt: new Date(Math.min(now.getTime(), startAt.getTime() - (2 + Math.floor(random() * 20)) * 86_400_000)),
        notes: random() < 0.2 ? pick(["Celebrating a birthday.", "Late arrival, around 9pm.", "One guest is vegetarian.", "Need a crib if possible."]) : null,
        payment:
          status === "COMPLETED" && !free
            ? {
                create:
                  paid < 0.85
                    ? { plan: "FULL", amountDue: total, claimedAt: new Date(startAt.getTime() - 3 * 86_400_000), status: "PAID", amountPaid: total, commissionPercent: 5, commissionAmount: (Math.round(Number(total) * 5) / 100).toFixed(2), method: "GCASH", paidAt: endAt, reference: method === "GCASH" ? `GC${Math.floor(random() * 1e10)}` : method === "BANK" ? `BT${Math.floor(random() * 1e8)}` : null }
                    : paid < 0.93
                      ? { plan: "DEPOSIT", amountDue: String(Math.round(Number(total) / 5)), claimedAt: new Date(startAt.getTime() - 3 * 86_400_000), status: "PARTIAL", amountPaid: String(Math.round(Number(total) / 5)), commissionPercent: 5, commissionAmount: (Math.round(Number(total) / 5 * 5) / 100).toFixed(2), method: "GCASH", paidAt: endAt }
                      : { plan: "DEPOSIT", amountDue: String(Math.round(Number(total) / 5)), claimedAt: new Date(startAt.getTime() - 3 * 86_400_000), status: "UNPAID", amountPaid: "0", method: "GCASH", reference: `GC${Math.floor(random() * 1e10)}` },
              }
            : status === "CONFIRMED" && !free && random() < 0.4
              ? { create: { plan: "DEPOSIT", amountDue: String(Math.round(Number(total) / 5)), claimedAt: new Date(startAt.getTime() - 5 * 86_400_000), status: "PARTIAL", amountPaid: String(Math.round(Number(total) / 5)), commissionPercent: 5, commissionAmount: (Math.round(Number(total) / 5 * 5) / 100).toFixed(2), method: "GCASH", paidAt: new Date(startAt.getTime() - 5 * 86_400_000) } }
              : undefined,
        review:
          status === "COMPLETED" && random() < 0.55
            ? {
                create: {
                  customerId: guest.id,
                  rating: pick([5, 5, 5, 4, 4, 3]),
                  comment: pick(comments),
                  createdAt: new Date(endAt.getTime() + 5 * 3_600_000),
                },
              }
            : undefined,
      },
    });
    created++;
  }

  for (const biz of [hotel, rental, tours, escape, venue, restaurant]) {
    for (const resource of biz.resources) {
      if (!resource.options.length) continue;
      const nightlyOptions = resource.options.map((n) => biz.options.get(n)!).filter((o) => o.bookingType === "NIGHTLY");
      const timedOptions = resource.options.map((n) => biz.options.get(n)!).filter((o) => o.bookingType === "TIMED");

      if (nightlyOptions.length) {
        // Walk through the calendar in stays of 1-4 nights, leaving gaps.
        let offset = -42;
        while (offset <= 14) {
          if (random() < 0.35) {
            offset += between(1, 3);
            continue;
          }
          const option = pick(nightlyOptions);
          const nights = between(1, 4);
          const checkIn = addDays(today, offset);
          const startAt = zonedTimeToUtc(checkIn, timeToMinutes(option.checkInTime ?? DEFAULT_CHECK_IN), TZ);
          const endAt = zonedTimeToUtc(addDays(checkIn, nights), timeToMinutes(option.checkOutTime ?? DEFAULT_CHECK_OUT), TZ);
          await createBooking(biz, resource.id, option, startAt, endAt, nights);
          offset += nights;
        }
        continue;
      }

      for (let offset = -42; offset <= 14; offset++) {
        const day = addDays(today, offset);
        for (const [, startTime, endTime] of resource.shifts.filter(([d]) => d === dayOfWeek(day))) {
          let minute = timeToMinutes(startTime);
          const end = timeToMinutes(endTime);
          while (minute < end) {
            const option = pick(timedOptions);
            const duration = option.durationMin!;
            if (minute + duration > end) break;
            // Big spaces are booked rarely; tables and rooms often.
            const chance = option.maxGuests >= 100 ? 0.12 : duration >= 240 ? 0.3 : 0.45;
            if (random() > chance) {
              minute += 30;
              continue;
            }
            const startAt = zonedTimeToUtc(day, minute, TZ);
            const endAt = new Date(startAt.getTime() + duration * 60_000);
            await createBooking(biz, resource.id, option, startAt, endAt, 0);
            minute += duration + (duration >= 240 ? 120 : 0);
          }
        }
      }
    }
  }

  // A few notifications so the bell isn't empty on first sign-in.
  await prisma.notification.createMany({
    data: [
      { userId: guests[0].id, title: "Welcome!", message: "Browse hotels, tours, venues and restaurants and make your first booking.", link: "/services" },
      { userId: hotel.owner.id, title: "Tip", message: "Check your reports page for this month's revenue and busiest rooms.", link: "/provider/reports" },
    ],
  });

  console.log(`Seeded ${created} bookings across 7 businesses.`);
  console.log(`Demo accounts (password: see DEMO_PASSWORD in prisma/seed.ts):`);
  console.log("  admin@example.com       Admin");
  console.log("  provider@example.com    Business owner (Harbor View Hotel)");
  console.log("  employee@example.com    Staff (Harbor View Hotel)");
  console.log("  tours@example.com       Business owner (Island Hop Palawan)");
  console.log("  pending@example.com     Business owner awaiting approval");
  console.log("  customer@example.com    Guest");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
