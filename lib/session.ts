import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import type { Role } from "@/lib/generated/prisma/client";
import { AppError } from "./errors";
import { prisma } from "./prisma";
import { homePathFor } from "./roles";

/**
 * The signed-in user, read from the database once per request instead of
 * trusting the session token, so suspensions and role changes apply at once.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      emailNotifications: true,
      isActive: true,
      emailVerifiedAt: true,
    },
  });
  return user?.isActive ? user : null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * For pages, layouts and server actions: redirects if signed out, not allowed,
 * or still waiting to verify the email address.
 */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.emailVerifiedAt) redirect("/verify");
  if (roles && !roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** For API routes: throws 401/403 instead of redirecting. */
export async function requireApiUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Please sign in first.");
  if (!user.emailVerifiedAt) throw new AppError("FORBIDDEN", "Please verify your email address first.");
  if (roles && !roles.includes(user.role)) throw new AppError("FORBIDDEN", "You don't have access to this.");
  return user;
}

/** The signed-in provider owner and their business. */
export const requireProvider = cache(async () => {
  const user = await requireUser(["PROVIDER"]);
  const provider = await prisma.provider.findUnique({ where: { ownerId: user.id } });
  if (!provider) redirect("/");
  return { user, provider };
});

/** The signed-in staff member (e.g. a tour guide) and their resource record. */
export const requireStaff = cache(async () => {
  const user = await requireUser(["EMPLOYEE"]);
  const resource = await prisma.resource.findUnique({
    where: { userId: user.id },
    include: { provider: { select: { id: true, businessName: true } } },
  });
  if (!resource) redirect("/");
  return { user, resource };
});
