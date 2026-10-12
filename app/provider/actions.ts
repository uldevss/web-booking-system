"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { notify } from "@/lib/notifications";
import { requestPayout } from "@/lib/payouts";
import { failed, formValues, invalid, type FormState } from "@/lib/forms";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProvider } from "@/lib/session";
import {
  providerProfileSchema,
  resourceCreateSchema,
  resourceServicesSchema,
  scheduleSchema,
  serviceSchema,
  staffCreateSchema,
  payoutRequestSchema,
} from "@/lib/validators";

// Every action re-checks that the signed-in provider owns what it touches.

async function ownedService(providerId: string, serviceId: string) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, providerId }, select: { id: true } });
  if (!service) throw new AppError("NOT_FOUND", "Booking option not found.");
  return service;
}

async function ownedResource(providerId: string, resourceId: string) {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, providerId },
    select: { id: true, userId: true, isActive: true },
  });
  if (!resource) throw new AppError("NOT_FOUND", "Resource not found.");
  return resource;
}

/** Keeps only ids that belong to this provider. */
async function ownIds(model: "service" | "resource", providerId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows =
    model === "service"
      ? await prisma.service.findMany({ where: { providerId, id: { in: ids } }, select: { id: true } })
      : await prisma.resource.findMany({ where: { providerId, id: { in: ids } }, select: { id: true } });
  return rows.map((row) => ({ id: row.id }));
}

// ── Business profile ────────────────────────────────────────────────────────

export async function updateBusinessProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider();
  const parsed = providerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  await prisma.provider.update({
    where: { id: provider.id },
    data: {
      businessName: parsed.data.businessName,
      category: parsed.data.category,
      address: parsed.data.address ?? null,
      description: parsed.data.description ?? null,
    },
  });
  revalidatePath("/provider", "layout");
  return { success: "Business profile saved." };
}

// ── Cash out ────────────────────────────────────────────────────────────────

export async function requestCashOut(_state: FormState, formData: FormData): Promise<FormState> {
  const { provider, user } = await requireProvider();
  const parsed = payoutRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const payout = await requestPayout(provider.id, parsed.data);
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await notify(
      admins.map((admin) => admin.id),
      {
        title: "Cash-out request",
        message: `${provider.businessName} (${user.name}) requested ${formatMoney(payout.amount)} to GCash ${payout.gcashNumber} (${payout.gcashName}).`,
        link: "/admin/earnings",
      },
    );
  } catch (error) {
    if (error instanceof AppError) return { error: error.message, values: formValues(formData) };
    throw error;
  }
  revalidatePath("/provider/earnings");
  return { success: "Cash-out requested. We'll send it to your GCash and let you know." };
}

// ── Booking options ─────────────────────────────────────────────────────────

export async function saveService(_state: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider();
  const serviceId = formData.get("id");
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    bookingType: formData.get("bookingType"),
    pricingUnit: formData.get("pricingUnit") ?? "PER_BOOKING",
    price: formData.get("price"),
    durationMin: formData.get("durationMin") ?? "",
    maxGuests: formData.get("maxGuests"),
    checkInTime: formData.get("checkInTime") || undefined,
    checkOutTime: formData.get("checkOutTime") || undefined,
    isActive: formData.get("isActive") === "on",
    resourceIds: formData.getAll("resourceIds"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);

  const { resourceIds, ...fields } = parsed.data;
  const resources = await ownIds("resource", provider.id, resourceIds);
  const data = { ...fields, description: fields.description ?? null };

  try {
    if (typeof serviceId === "string" && serviceId) {
      await ownedService(provider.id, serviceId);
      await prisma.service.update({ where: { id: serviceId }, data: { ...data, resources: { set: resources } } });
    } else {
      await prisma.service.create({ data: { ...data, providerId: provider.id, resources: { connect: resources } } });
    }
  } catch (error) {
    return failed(error, formData);
  }
  revalidatePath("/provider/services");
  redirect("/provider/services");
}

/** Deletes an option that was never booked; otherwise it is deactivated to keep history. */
export async function deleteService(serviceId: string): Promise<FormState> {
  const { provider } = await requireProvider();
  try {
    await ownedService(provider.id, serviceId);
    const used = await prisma.booking.count({ where: { serviceId } });
    if (used) {
      await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
      revalidatePath("/provider/services");
      return { success: "This option has bookings, so it was deactivated instead of deleted." };
    }
    await prisma.service.delete({ where: { id: serviceId } });
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/provider/services");
  return { success: "Booking option deleted." };
}

// ── Staff & resources ───────────────────────────────────────────────────────

/** A room, rental unit, table or space: bookable, but no login. */
export async function createResource(_state: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider();
  const parsed = resourceCreateSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);

  const resource = await prisma.resource.create({
    data: {
      providerId: provider.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      services: { connect: await ownIds("service", provider.id, parsed.data.serviceIds) },
    },
    select: { id: true },
  });
  revalidatePath("/provider/resources");
  redirect(`/provider/resources/${resource.id}?created=1`);
}

/** A staff member (e.g. a tour guide) who gets a login to see their bookings. */
export async function createStaff(_state: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider();
  const parsed = staffCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, email, phone, password, serviceIds } = parsed.data;

  let resourceId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: "EMPLOYEE",
        passwordHash: await bcrypt.hash(password, 10),
        resource: {
          create: {
            providerId: provider.id,
            kind: "STAFF",
            services: { connect: await ownIds("service", provider.id, serviceIds) },
          },
        },
      },
      select: { resource: { select: { id: true } } },
    });
    resourceId = user.resource!.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fields: { email: "An account with this email already exists." }, values: formValues(formData) };
    }
    throw error;
  }
  revalidatePath("/provider/resources");
  redirect(`/provider/resources/${resourceId}?created=1`);
}

/** For owners who guide tours or host bookings themselves. */
export async function addSelfAsStaff(): Promise<void> {
  const { user, provider } = await requireProvider();
  const existing = await prisma.resource.findUnique({ where: { userId: user.id }, select: { id: true } });
  const resource =
    existing ??
    (await prisma.resource.create({
      data: { userId: user.id, providerId: provider.id, kind: "STAFF" },
      select: { id: true },
    }));
  revalidatePath("/provider/resources");
  redirect(`/provider/resources/${resource.id}`);
}

export async function updateResourceServices(resourceId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider();
  const parsed = resourceServicesSchema.safeParse({ serviceIds: formData.getAll("serviceIds") });
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await ownedResource(provider.id, resourceId);
    await prisma.resource.update({
      where: { id: resourceId },
      data: { services: { set: await ownIds("service", provider.id, parsed.data.serviceIds) } },
    });
  } catch (error) {
    return failed(error);
  }
  revalidatePath(`/provider/resources/${resourceId}`);
  return { success: "Saved." };
}

/** Replaces the resource's weekly opening hours. Existing bookings are kept. */
export async function saveSchedule(
  resourceId: string,
  rows: { dayOfWeek: number; startTime: string; endTime: string }[],
): Promise<FormState> {
  const { provider } = await requireProvider();
  const parsed = scheduleSchema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the hours." };
  try {
    await ownedResource(provider.id, resourceId);
    await prisma.$transaction([
      prisma.workSchedule.deleteMany({ where: { resourceId } }),
      prisma.workSchedule.createMany({ data: parsed.data.map((row) => ({ ...row, resourceId })) }),
    ]);
  } catch (error) {
    return failed(error);
  }
  revalidatePath(`/provider/resources/${resourceId}`);
  return { success: "Hours saved." };
}

/**
 * Inactive resources get no new bookings, and staff (other than the owner)
 * can no longer sign in. Upcoming bookings must be reassigned first.
 */
export async function setResourceActive(resourceId: string, active: boolean): Promise<FormState> {
  const { user, provider } = await requireProvider();
  try {
    const resource = await ownedResource(provider.id, resourceId);
    if (!active) {
      const upcoming = await prisma.booking.count({
        where: { resourceId, status: { in: ACTIVE_STATUSES }, endAt: { gt: new Date() } },
      });
      if (upcoming) {
        return {
          error: `Move this resource's ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"} to another one before deactivating it.`,
        };
      }
    }
    await prisma.$transaction([
      prisma.resource.update({ where: { id: resourceId }, data: { isActive: active } }),
      ...(resource.userId && resource.userId !== user.id
        ? [prisma.user.update({ where: { id: resource.userId }, data: { isActive: active } })]
        : []),
    ]);
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/provider/resources");
  revalidatePath(`/provider/resources/${resourceId}`);
  return { success: active ? "Reactivated." : "Deactivated." };
}
