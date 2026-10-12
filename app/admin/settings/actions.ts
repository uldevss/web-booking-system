"use server";

import { revalidatePath } from "next/cache";
import { formValues, invalid, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { platformSettingsSchema, qrImageSchema } from "@/lib/validators";

export async function updatePlatformSettings(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const parsed = platformSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  revalidatePath("/", "layout");
  return { success: "Payment settings saved.", values: formValues(formData) };
}

/** Replaces (or clears, with "") the GCash QR image shown at checkout. */
export async function updateGcashQr(image: string): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const parsed = qrImageSchema.safeParse({ image });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.platformSettings.upsert({
    where: { id: "default" },
    update: { gcashQrUrl: parsed.data.image || null },
    create: { id: "default", gcashQrUrl: parsed.data.image || null },
  });
  revalidatePath("/", "layout");
  return { success: parsed.data.image ? "QR code updated." : "QR code removed." };
}
