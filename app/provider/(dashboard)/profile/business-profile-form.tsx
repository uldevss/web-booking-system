"use client";

import { useActionState } from "react";
import { updateBusinessProfile } from "@/app/provider/actions";
import { CategorySelect } from "@/components/category-select";
import { FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/form-fields";
import type { BusinessCategory } from "@/lib/generated/prisma/enums";

export function BusinessProfileForm({
  provider,
  depositPercent,
}: {
  provider: {
    businessName: string;
    category: BusinessCategory;
    address: string | null;
    description: string | null;
  };
  depositPercent: number;
}) {
  const [state, action] = useActionState(updateBusinessProfile, undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <TextField name="businessName" label="Business name" defaultValue={provider.businessName} required state={state} />
      <CategorySelect state={state} defaultValue={provider.category} />
      <TextField name="address" label="Address" defaultValue={provider.address ?? ""} state={state} />
      <TextAreaField name="description" label="Description" rows={4} defaultValue={provider.description ?? ""} state={state} />
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Guests pay a {depositPercent}% deposit or the full amount by GCash to the platform&apos;s account when they book. You confirm
        each payment on the booking, and your share (minus the platform commission) shows under Earnings.
      </p>
      <div>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
