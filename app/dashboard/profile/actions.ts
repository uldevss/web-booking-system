"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { invalid, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { avatarSchema, passwordChangeSchema, profileSchema } from "@/lib/validators";

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    emailNotifications: formData.get("emailNotifications") === "on",
  });
  if (!parsed.success) return invalid(parsed.error, formData);

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null, emailNotifications: parsed.data.emailNotifications },
  });
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}

/** Saves a photo already resized in the browser (data: URL), or removes it with "". */
export async function updateAvatar(avatar: string): Promise<FormState> {
  const user = await requireUser();
  const parsed = avatarSchema.safeParse({ avatar });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: parsed.data.avatar || null } });
  revalidatePath("/", "layout");
  return { success: parsed.data.avatar ? "Photo updated." : "Photo removed." };
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(parsed.data.currentPassword, account.passwordHash))) {
    return { fields: { currentPassword: "That isn't your current password." } };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  return { success: "Password changed." };
}
