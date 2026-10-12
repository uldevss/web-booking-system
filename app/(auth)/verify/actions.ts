"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { formValues, invalid, safeRedirectPath, type FormState } from "@/lib/forms";
import { homePathFor } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { verifyCodeSchema } from "@/lib/validators";
import { confirmVerificationCode, sendVerificationCode } from "@/lib/verification";

export async function verifyEmail(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = verifyCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    await confirmVerificationCode(user.id, parsed.data.code);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message, values: formValues(formData) };
    throw error;
  }
  redirect(safeRedirectPath(formData.get("callbackUrl")) ?? homePathFor(user.role));
}

export async function resendVerificationCode(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) return { success: "Your email is already verified." };
  try {
    await sendVerificationCode(user);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  return { success: `We sent a new code to ${user.email}.` };
}
