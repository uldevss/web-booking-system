"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { formValues, invalid, type FormState } from "@/lib/forms";
import { formatMoney } from "@/lib/format";
import { notify } from "@/lib/notifications";
import { resolvePayout } from "@/lib/payouts";
import { requireUser } from "@/lib/session";
import { payoutResolveSchema } from "@/lib/validators";

/** Admin records a cash-out as sent (GCash reference) or rejects it with a note. */
export async function resolveCashOut(_state: FormState, formData: FormData): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const parsed = payoutResolveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    const payout = await resolvePayout(parsed.data);
    await notify(payout.provider.ownerId, {
      title: payout.status === "PAID" ? "Cash-out sent" : "Cash-out rejected",
      message:
        payout.status === "PAID"
          ? `${formatMoney(payout.amount)} was sent to GCash ${payout.gcashNumber}. Reference: ${payout.reference}.`
          : `Your cash-out of ${formatMoney(payout.amount)} was rejected: ${payout.note}`,
      link: "/provider/earnings",
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message, values: formValues(formData) };
    throw error;
  }
  revalidatePath("/admin/earnings");
  return { success: "Cash-out updated." };
}
