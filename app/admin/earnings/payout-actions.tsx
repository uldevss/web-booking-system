"use client";

import { useActionState, useState } from "react";
import { resolveCashOut } from "@/app/admin/earnings/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";

/** Admin controls for one waiting cash-out: mark as sent (with reference) or reject. */
export function PayoutActions({ payoutId }: { payoutId: string }) {
  const [mode, setMode] = useState<"idle" | "paid" | "rejected">("idle");
  const [state, action] = useActionState(resolveCashOut, undefined);

  if (mode === "idle") {
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => setMode("paid")}>
          Mark as sent
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("rejected")}>
          Reject
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid min-w-64 gap-2 text-left">
      <input type="hidden" name="payoutId" value={payoutId} />
      <input type="hidden" name="decision" value={mode} />
      <FormMessage state={state} />
      {mode === "paid" ? (
        <TextField name="reference" label="GCash reference" placeholder="From the GCash receipt" required state={state} />
      ) : (
        <TextField name="note" label="Reason" placeholder="Why it was rejected" required state={state} />
      )}
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          {mode === "paid" ? "Confirm sent" : "Confirm rejection"}
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
