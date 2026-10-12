import "server-only";
import { after } from "next/server";
import type { BookingWithRelations } from "./bookings";
import { siteConfig } from "./config";
import { notificationEmail, sendEmail } from "./email";
import { formatDate, formatDateTime, formatMoney } from "./format";
import { prisma } from "./prisma";
import { addDays, dayBounds, toDayKey } from "./time";

type Note = { title: string; message: string; link?: string };

/** Runs `task` after the response is sent; runs it now outside a request (cron, scripts, tests). */
function afterResponse(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

/**
 * The single notification entry point: stores an in-app notification for each
 * user and emails those who keep email notifications on.
 */
export async function notify(userIds: string | null | undefined | (string | null | undefined)[], note: Note) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter((id): id is string => !!id))];
  if (!ids.length) return;

  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, ...note })) });

  const recipients = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true, emailNotifications: true },
    select: { name: true, email: true },
  });
  if (recipients.length) {
    afterResponse(() => Promise.all(recipients.map((user) => sendEmail(notificationEmail(user, note)))));
  }
}

// ── Booking events ──────────────────────────────────────────────────────────

/** "Mon, Oct 5, 2026, 2:00 PM", or "Oct 5 – Oct 7 (2 nights)" style for stays. */
function when(b: Pick<BookingWithRelations, "startAt" | "endAt" | "service">) {
  if (b.service.bookingType !== "NIGHTLY") return formatDateTime(b.startAt);
  return `${formatDate(b.startAt)} to ${formatDate(b.endAt)}`;
}

const describe = (b: BookingWithRelations) => `${b.service.name} at ${b.provider.businessName}, ${when(b)}`;

const links = (b: BookingWithRelations) => ({
  customer: `/dashboard/bookings/${b.id}`,
  provider: `/provider/bookings/${b.id}`,
  staff: `/employee/bookings/${b.id}`,
});

/** The assigned staff member's user id: only staff resources have logins, and owners are notified as the business. */
function staffUserId(b: BookingWithRelations) {
  const id = b.resource?.userId;
  return id && id !== b.provider.ownerId ? id : null;
}

export async function notifyBookingCreated(b: BookingWithRelations) {
  await notify(b.customerId, {
    title: "Booking received",
    message: `Your booking for ${describe(b)} is waiting for the business to confirm it.`,
    link: links(b).customer,
  });
  const paid = b.payment?.claimedAt
    ? ` They report paying ${formatMoney(b.payment.amountDue)} (${b.payment.plan === "DEPOSIT" ? "deposit" : "in full"}) via ${b.payment.method}, ref. ${b.payment.reference ?? "n/a"}. Please check and confirm.`
    : " Please confirm it.";
  await notify(b.provider.ownerId, {
    title: "New booking request",
    message: `${b.customer.name} booked ${b.service.name} for ${when(b)} (${b.guests} guest${b.guests === 1 ? "" : "s"}).${paid}`,
    link: links(b).provider,
  });
  await notify(staffUserId(b), {
    title: "New booking assigned to you",
    message: `${b.service.name} with ${b.customer.name}, ${when(b)}.`,
    link: links(b).staff,
  });
}

export async function notifyBookingConfirmed(b: BookingWithRelations) {
  await notify(b.customerId, {
    title: "Booking confirmed",
    message: `${describe(b)} is confirmed. See you there!`,
    link: links(b).customer,
  });
  await notify(staffUserId(b), {
    title: "Booking confirmed",
    message: `${b.service.name} with ${b.customer.name}, ${when(b)}, is confirmed.`,
    link: links(b).staff,
  });
}

export async function notifyBookingCancelled(b: BookingWithRelations, cancelledBy: string) {
  const message = `${describe(b)} was cancelled by ${cancelledBy}.`;
  await notify(b.customerId, { title: "Booking cancelled", message, link: links(b).customer });
  await notify(b.provider.ownerId, { title: "Booking cancelled", message, link: links(b).provider });
  await notify(staffUserId(b), { title: "Booking cancelled", message, link: links(b).staff });
}

export async function notifyBookingRescheduled(b: BookingWithRelations, previous: BookingWithRelations) {
  const message = `${b.service.name} at ${b.provider.businessName} moved from ${when(previous)} to ${when(b)}.`;
  await notify(b.customerId, { title: "Booking rescheduled", message, link: links(b).customer });
  await notify(b.provider.ownerId, { title: "Booking rescheduled", message, link: links(b).provider });
  await notify(staffUserId(b), { title: "Booking rescheduled", message, link: links(b).staff });
  const previousStaff = staffUserId(previous);
  if (previousStaff && previousStaff !== staffUserId(b)) {
    await notify(previousStaff, {
      title: "Booking reassigned",
      message: `${previous.service.name} with ${previous.customer.name}, ${when(previous)}, was given to someone else.`,
    });
  }
}

export async function notifyResourceChanged(b: BookingWithRelations, previous: BookingWithRelations) {
  await notify(staffUserId(b), {
    title: "New booking assigned to you",
    message: `You were assigned ${b.service.name} with ${b.customer.name}, ${when(b)}.`,
    link: links(b).staff,
  });
  const previousStaff = staffUserId(previous);
  if (previousStaff && previousStaff !== staffUserId(b)) {
    await notify(previousStaff, {
      title: "Booking reassigned",
      message: `${b.service.name} with ${b.customer.name}, ${when(b)}, was given to someone else.`,
    });
  }
}

export async function notifyBookingCompleted(b: BookingWithRelations) {
  await notify(b.customerId, {
    title: "How was it?",
    message: `Thanks for choosing ${b.provider.businessName}. Leave a review of ${b.service.name} to help other guests.`,
    link: `${links(b).customer}#review`,
  });
}

export async function notifyPaymentRecorded(b: BookingWithRelations) {
  if (!b.payment || (b.payment.status !== "PAID" && b.payment.status !== "PARTIAL")) return;
  await notify(b.customerId, {
    title: b.payment.status === "PAID" ? "Payment received" : "Partial payment received",
    message: `${b.provider.businessName} recorded ${formatMoney(b.payment.amountPaid)} for ${b.service.name} (${when(b)}).`,
    link: links(b).customer,
  });
}

// ── Daily job ───────────────────────────────────────────────────────────────

/**
 * Reminds guests (and assigned staff) about tomorrow's confirmed bookings and
 * check-ins, and nudges businesses about tomorrow's bookings they haven't
 * confirmed yet. Safe to run more than once a day: each booking is claimed
 * before sending.
 */
export async function sendDailyReminders(now = new Date()) {
  const tomorrow = addDays(toDayKey(now, siteConfig.timeZone), 1);
  const { start, end } = dayBounds(tomorrow, siteConfig.timeZone);
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gte: start, lt: end }, reminderSentAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      provider: { select: { id: true, businessName: true, ownerId: true } },
      service: { select: { name: true, bookingType: true } },
      resource: { select: { userId: true } },
    },
    orderBy: { startAt: "asc" },
  });

  let reminded = 0;
  const pendingByProvider = new Map<string, { ownerId: string; count: number }>();

  for (const b of bookings) {
    const claimed = await prisma.booking.updateMany({
      where: { id: b.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (!claimed.count) continue;

    if (b.status === "CONFIRMED") {
      reminded++;
      const stay = b.service.bookingType === "NIGHTLY";
      await notify(b.customerId, {
        title: stay ? "Reminder: check-in tomorrow" : "Reminder: your booking is tomorrow",
        message: `${b.service.name} at ${b.provider.businessName}, ${stay ? "check-in " : ""}${formatDateTime(b.startAt)}.`,
        link: `/dashboard/bookings/${b.id}`,
      });
      if (b.resource?.userId && b.resource.userId !== b.provider.ownerId) {
        await notify(b.resource.userId, {
          title: "Reminder: booking tomorrow",
          message: `${b.service.name} with ${b.customer.name}, ${formatDateTime(b.startAt)}.`,
          link: `/employee/bookings/${b.id}`,
        });
      }
    } else {
      const entry = pendingByProvider.get(b.providerId) ?? { ownerId: b.provider.ownerId, count: 0 };
      entry.count++;
      pendingByProvider.set(b.providerId, entry);
    }
  }

  for (const { ownerId, count } of pendingByProvider.values()) {
    await notify(ownerId, {
      title: "Unconfirmed bookings tomorrow",
      message: `${count} booking${count === 1 ? "" : "s"} tomorrow still need${count === 1 ? "s" : ""} your confirmation.`,
      link: "/provider/bookings?status=PENDING",
    });
  }

  return { reminded, providersNudged: pendingByProvider.size };
}
