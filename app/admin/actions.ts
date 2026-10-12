"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/forms";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function setProviderApproved(providerId: string, approved: boolean): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const provider = await prisma.provider.update({
    where: { id: providerId },
    data: { isApproved: approved },
    select: { ownerId: true, businessName: true },
  });
  await notify(
    provider.ownerId,
    approved
      ? {
          title: "Your business is approved",
          message: `${provider.businessName} is now listed and customers can book your services.`,
          link: "/provider",
        }
      : {
          title: "Your listing was suspended",
          message: `${provider.businessName} is hidden from customers for now. Contact the platform admin for details.`,
          link: "/provider",
        },
  );
  revalidatePath("/admin/providers");
  return { success: approved ? `${provider.businessName} approved.` : `${provider.businessName} suspended.` };
}

export async function setUserActive(userId: string, active: boolean): Promise<FormState> {
  const admin = await requireUser(["ADMIN"]);
  if (userId === admin.id) return { error: "You can't suspend your own account." };
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  revalidatePath("/admin/users");
  return { success: active ? "Account reactivated." : "Account suspended." };
}

export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<FormState> {
  await requireUser(["ADMIN"]);
  await prisma.review.update({ where: { id: reviewId }, data: { isHidden: hidden } });
  revalidatePath("/admin/reviews");
  return { success: hidden ? "Review hidden." : "Review visible again." };
}

export async function deleteReview(reviewId: string): Promise<FormState> {
  await requireUser(["ADMIN"]);
  await prisma.review.delete({ where: { id: reviewId } });
  revalidatePath("/admin/reviews");
  return { success: "Review deleted." };
}
