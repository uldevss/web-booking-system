"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { formValues, invalid, safeRedirectPath, type FormState } from "@/lib/forms";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, retryMessage } from "@/lib/rate-limit";
import { homePathFor } from "@/lib/roles";
import { loginSchema, providerRegisterSchema, registerSchema } from "@/lib/validators";
import { sendVerificationCode } from "@/lib/verification";

const PASSWORD_COST = 10;

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const message =
        error.code === "rate_limited"
          ? "Too many sign-in attempts. Please wait 15 minutes and try again."
          : error.code === "suspended"
            ? "This account has been suspended. Contact support if you think this is a mistake."
            : "Wrong email or password.";
      return { error: message, values: formValues(formData) };
    }
    if (error instanceof AuthError) return { error: "Couldn't sign you in. Please try again.", values: formValues(formData) };
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { role: true } });
  redirect(safeRedirectPath(formData.get("callbackUrl")) ?? homePathFor(user?.role));
}

/** Shared by both sign-up forms: limits sign-ups per IP and rejects taken emails. */
async function checkSignUp(email: string, formData: FormData): Promise<FormState | null> {
  const limit = await rateLimit(`register:${clientIp(await headers())}`, 5, 60 * 60);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSeconds), values: formValues(formData) };
  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, emailCodeExpiresAt: true },
  });
  if (!taken) return null;
  // An account that never entered its code (mistyped or non-existent address,
  // or someone else's) is released once its code has expired, so the address
  // can be used again instead of being locked forever.
  if (!taken.emailVerifiedAt && (!taken.emailCodeExpiresAt || taken.emailCodeExpiresAt < new Date())) {
    try {
      await prisma.user.delete({ where: { id: taken.id } });
      return null;
    } catch {
      // Fall through to the normal message if it can't be removed.
    }
  }
  return {
    fields: {
      email: taken.emailVerifiedAt
        ? "An account with this email already exists."
        : "This email was used to sign up recently and is waiting for its code. Log in with it, or try again after 15 minutes.",
    },
    values: formValues(formData),
  };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function register(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, email, phone, password } = parsed.data;

  const problem = await checkSignUp(email, formData);
  if (problem) return problem;

  let user: { id: string; name: string; email: string };
  try {
    user = await prisma.user.create({
      data: { name, email, phone, passwordHash: await bcrypt.hash(password, PASSWORD_COST) },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fields: { email: "An account with this email already exists." }, values: formValues(formData) };
    }
    throw error;
  }

  await sendVerificationCode(user);
  await signIn("credentials", { email, password, redirect: false });
  redirect(verifyPath(safeRedirectPath(formData.get("callbackUrl")) ?? "/dashboard"));
}

/** The verification page, remembering where to go afterwards. */
function verifyPath(next: string) {
  return `/verify?callbackUrl=${encodeURIComponent(next)}`;
}

export async function registerProvider(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = providerRegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, email, phone, password, businessName, category, address, description } = parsed.data;

  const problem = await checkSignUp(email, formData);
  if (problem) return problem;

  let user: { id: string; name: string; email: string };
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        role: "PROVIDER",
        passwordHash: await bcrypt.hash(password, PASSWORD_COST),
        provider: { create: { businessName, category, address, description } },
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fields: { email: "An account with this email already exists." }, values: formValues(formData) };
    }
    throw error;
  }

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await notify(
    admins.map((admin) => admin.id),
    {
      title: "New provider awaiting approval",
      message: `${businessName} (${name}) registered and is waiting for approval.`,
      link: "/admin/providers",
    },
  );

  await sendVerificationCode(user);
  await signIn("credentials", { email, password, redirect: false });
  redirect(verifyPath("/provider"));
}

/** "Continue with Google": sends the person to Google, then back to `callbackUrl`. */
export async function loginWithGoogle(formData: FormData) {
  const next = safeRedirectPath(formData.get("callbackUrl")) ?? "/dashboard";
  await signIn("google", { redirectTo: next });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
