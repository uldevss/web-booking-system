import { z } from "zod";
import { MAX_NIGHTS } from "./catalog";
import { findScheduleProblem, toWorkingRanges } from "./slots";
import { isDayKey, timeToMinutes } from "./time";

// Input schemas shared by API routes and server actions. Everything coming
// from a browser is validated here first.

const id = z.string().trim().min(1).max(64);

/** Optional free text: blank strings become undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => value || undefined);

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

const password = z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters.");

const personName = z.string().trim().min(2, "Enter a name.").max(100, "Keep the name under 100 characters.");

const phone = z
  .string()
  .trim()
  .max(30, "Keep the phone number under 30 characters.")
  .regex(/^[0-9+()\-\s]*$/, "Use digits, spaces, +, - or parentheses.")
  .optional()
  .transform((value) => value || undefined);

const dayKey = z.string().refine(isDayKey, "Use the format YYYY-MM-DD.");
const clockTime = z.string().refine((value) => !Number.isNaN(timeToMinutes(value)), "Use a time like 09:00.");
const isoInstant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const money = z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 500 or 499.50.");
const category = z.enum(
  ["HOTEL", "SHORT_TERM_RENTAL", "TOUR_OPERATOR", "ESCAPE_ROOM", "EVENT_VENUE", "RESTAURANT"],
  "Choose what kind of business this is.",
);
const guests = z.coerce.number("Enter the number of guests.").int().min(1, "At least 1 guest.").max(1000);
const nights = z.coerce.number().int().min(1, "At least 1 night.").max(MAX_NIGHTS, `At most ${MAX_NIGHTS} nights.`);

// ── Accounts & profiles ─────────────────────────────────────────────────────

/** Domains sign-ups may use (ALLOWED_EMAIL_DOMAINS, comma-separated); empty means any. */
export function allowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

const signUpEmail = email.refine(
  (value) => {
    const domains = allowedEmailDomains();
    return domains.length === 0 || domains.includes(value.slice(value.lastIndexOf("@") + 1));
  },
  {
    error: () => {
      const domains = allowedEmailDomains();
      return domains.length === 1 ? `Use a ${domains[0]} address.` : `Use an email ending in ${domains.join(", ")}.`;
    },
  },
);

export const registerSchema = z.object({ name: personName, email: signUpEmail, phone, password });

export const verifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the email."),
});

export const providerRegisterSchema = registerSchema.extend({
  businessName: z.string().trim().min(2, "Enter your business name.").max(120),
  category,
  address: optionalText(200),
  description: optionalText(1000),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const profileSchema = z.object({
  name: personName,
  phone,
  emailNotifications: z.boolean(),
});

/** Resized photo from the browser, or "" to remove it. */
export const avatarSchema = z.object({
  avatar: z
    .string()
    .max(150_000, "That image is too large.")
    .refine(
      (value) => value === "" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value),
      "Upload a JPEG, PNG or WebP image.",
    ),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    error: "The passwords don't match.",
  });

// ── Provider back office ────────────────────────────────────────────────────

export const providerProfileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(120),
  category,
  address: optionalText(200),
  description: optionalText(1000),
});

/**
 * A bookable option. Timed options need a duration; nightly stays are always
 * priced per night and have check-in / check-out times.
 */
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name.").max(100),
    description: optionalText(1000),
    bookingType: z.enum(["TIMED", "NIGHTLY"]),
    pricingUnit: z.enum(["PER_BOOKING", "PER_PERSON", "PER_NIGHT"]),
    price: money,
    durationMin: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number("Enter the length in minutes.").int("Use whole minutes.").min(5, "At least 5 minutes.").max(1440, "At most 24 hours.").optional(),
    ),
    maxGuests: z.coerce.number("Enter the maximum number of guests.").int().min(1, "At least 1 guest.").max(1000, "At most 1000 guests."),
    checkInTime: clockTime.optional(),
    checkOutTime: clockTime.optional(),
    isActive: z.boolean(),
    resourceIds: z.array(id).max(500),
  })
  .superRefine((value, ctx) => {
    if (value.bookingType === "TIMED" && !value.durationMin) {
      ctx.addIssue({ code: "custom", path: ["durationMin"], message: "Enter how long a booking lasts." });
    }
    if (value.bookingType === "TIMED" && value.pricingUnit === "PER_NIGHT") {
      ctx.addIssue({ code: "custom", path: ["pricingUnit"], message: "Per-night pricing is for overnight stays." });
    }
  })
  .transform((value) =>
    value.bookingType === "NIGHTLY"
      ? {
          ...value,
          pricingUnit: "PER_NIGHT" as const,
          durationMin: null,
          checkInTime: value.checkInTime ?? "14:00",
          checkOutTime: value.checkOutTime ?? "12:00",
        }
      : { ...value, durationMin: value.durationMin ?? null, checkInTime: null, checkOutTime: null },
  );

/** A room, rental unit, table or space (no login). */
export const resourceCreateSchema = z.object({
  kind: z.enum(["ROOM", "UNIT", "TABLE", "SPACE"], "Choose what this resource is."),
  name: z.string().trim().min(1, "Give it a name, like Room 101 or Table 4.").max(80),
  serviceIds: z.array(id).max(200),
});

/** A staff member who logs in (e.g. a tour guide). */
export const staffCreateSchema = z.object({
  name: personName,
  email,
  phone,
  password,
  serviceIds: z.array(id).max(200),
});

export const resourceServicesSchema = z.object({ serviceIds: z.array(id).max(200) });

export const scheduleSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: clockTime,
      endTime: clockTime,
    }),
  )
  .max(70)
  .superRefine((rows, ctx) => {
    const problem = findScheduleProblem(toWorkingRanges(rows));
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

// ── Bookings ────────────────────────────────────────────────────────────────

export const availabilityQuerySchema = z
  .object({
    serviceId: id,
    date: dayKey.optional(),
    from: dayKey.optional(),
    to: dayKey.optional(),
    /** A booking being rescheduled; its current slot counts as free. */
    exclude: id.optional(),
    /** Overnight stays: length of the stay to check. */
    nights: nights.optional(),
  })
  .transform(({ date, from, to, ...rest }) => ({ ...rest, from: date ?? from, to: date ?? to }))
  .pipe(
    z
      .object({
        serviceId: id,
        from: z.string("Pass `date`, or `from` and `to`."),
        to: z.string("Pass `date`, or `from` and `to`."),
        exclude: id.optional(),
        nights: z.number().int().default(1),
      })
      .refine((q) => q.from <= q.to, "`from` must not be after `to`.")
      .refine(
        (q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 42,
        "Request at most 6 weeks at a time.",
      ),
  );

/** A start time for timed options, or check-in day + nights for overnight stays. */
const whenFields = {
  startAt: isoInstant.optional(),
  checkIn: dayKey.optional(),
  nights: nights.optional(),
};

type WhenFields = { startAt?: Date; checkIn?: string; nights?: number };
const hasWhen = (value: WhenFields) => Boolean(value.startAt || (value.checkIn && value.nights));
const toWhen = (value: WhenFields) =>
  value.checkIn && value.nights ? { checkIn: value.checkIn, nights: value.nights } : { startAt: value.startAt! };
const whenMessage = "Choose a time, or a check-in date and number of nights.";

/** How the guest paid upfront: a deposit or the full amount, with the transfer reference. */
export const checkoutPaymentSchema = z.object({
  plan: z.enum(["DEPOSIT", "FULL"]),
  method: z.literal("GCASH", "Payments are made with GCash."),
  reference: z.string().trim().min(4, "Enter the reference number from your payment.").max(100),
});

/** Note: no price field. Prices are always read from the database. */
export const createBookingSchema = z
  .object({ serviceId: id, ...whenFields, guests: guests.default(1), notes: optionalText(500), payment: checkoutPaymentSchema.optional() })
  .refine(hasWhen, whenMessage)
  .transform(({ startAt, checkIn, nights, ...rest }) => ({ ...rest, when: toWhen({ startAt, checkIn, nights }) }));

export const updateBookingSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z
    .object({ action: z.literal("reschedule"), ...whenFields })
    .refine(hasWhen, whenMessage)
    .transform((value) => ({ action: value.action, when: toWhen(value) })),
  z.object({
    action: z.literal("status"),
    status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]),
  }),
  z.object({ action: z.literal("assign"), resourceId: id }),
]);

export const paymentSchema = z.object({
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "REFUNDED"]),
  amountPaid: money,
  method: z.enum(["CASH", "GCASH", "CARD", "BANK"]),
  reference: optionalText(100),
});

export const platformSettingsSchema = z.object({
  gcashName: z.string().trim().min(2, "Enter the account name.").max(80),
  gcashNumber: z
    .string()
    .trim()
    .regex(/^(\+?63|0)?[\d ]{9,14}$/, "Enter a Philippine mobile number, e.g. 0917 123 4567."),
  commissionPercent: z.coerce.number("Enter a percent.").min(0, "At least 0.").max(50, "At most 50."),
});

/** The GCash QR image as a data: URL (PNG, JPEG, WebP or SVG), at most ~400 KB. */
export const qrImageSchema = z.object({
  image: z
    .string()
    .max(560_000, "That image is too large. Use a smaller QR image.")
    .regex(/^(data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+)?$/, "Choose an image file."),
});

export const payoutRequestSchema = z.object({
  amount: money,
  gcashName: z.string().trim().min(2, "Enter the GCash account name.").max(80),
  gcashNumber: z
    .string()
    .trim()
    .regex(/^(\+?63|0)?[\d ]{9,14}$/, "Enter a Philippine mobile number, e.g. 0917 123 4567."),
});

export const payoutResolveSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("paid"), payoutId: id, reference: z.string().trim().min(4, "Enter the GCash reference.").max(100) }),
  z.object({ decision: z.literal("rejected"), payoutId: id, note: z.string().trim().min(3, "Say why.").max(300) }),
]);

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Pick a rating from 1 to 5.").max(5, "Pick a rating from 1 to 5."),
  comment: optionalText(1000),
});

export const markNotificationsSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(id).min(1).max(100) }),
]);

// ── Reports ─────────────────────────────────────────────────────────────────

export const reportQuerySchema = z
  .object({
    from: dayKey,
    to: dayKey,
    groupBy: z.enum(["day", "week", "month"]).default("day"),
    providerId: id.optional(),
  })
  .refine(({ from, to }) => from <= to, "`from` must not be after `to`.")
  .refine(({ from, to }) => (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 366, "Pick at most one year.");
