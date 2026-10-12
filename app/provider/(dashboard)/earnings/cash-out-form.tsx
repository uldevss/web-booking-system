"use client";

import { useActionState } from "react";
import { requestCashOut } from "@/app/provider/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";

export function CashOutForm({
  available,
  defaults,
  disabledReason,
}: {
  /** Amount that can be cashed out now, as a decimal string. */
  available: string;
  defaults: { gcashName: string; gcashNumber: string };
  disabledReason?: string | null;
}) {
  const [state, action] = useActionState(requestCashOut, undefined);
  const disabled = Boolean(disabledReason) || Number(available) <= 0;
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="gcashName" label="GCash account name" defaultValue={defaults.gcashName} required state={state} disabled={disabled} />
        <TextField
          name="gcashNumber"
          label="GCash number"
          defaultValue={defaults.gcashNumber}
          inputMode="tel"
          placeholder="0917 123 4567"
          required
          state={state}
          disabled={disabled}
        />
      </div>
      <TextField
        name="amount"
        label="Amount to cash out"
        defaultValue={available}
        inputMode="decimal"
        required
        className="sm:max-w-xs"
        hint={`Up to ${available} available.`}
        state={state}
        disabled={disabled}
      />
      {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
      <div>
        <SubmitButton pendingText="Requesting…" disabled={disabled}>
          Cash out to GCash
        </SubmitButton>
      </div>
    </form>
  );
}
