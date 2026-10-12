"use client";

import { useActionState } from "react";
import { resendVerificationCode, verifyEmail } from "@/app/(auth)/verify/actions";
import { logout } from "@/app/(auth)/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";

export function VerifyForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(verifyEmail, undefined);
  const [resendState, resend] = useActionState(resendVerificationCode, undefined);

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4">
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <FormMessage state={state} />
        <TextField
          name="code"
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          required
          autoFocus
          className="max-w-xs"
          state={state}
        />
        <SubmitButton className="w-full" pendingText="Checking…">
          Verify email
        </SubmitButton>
      </form>

      <form action={resend} className="grid gap-2">
        <FormMessage state={resendState} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Didn&apos;t get it? Check your spam folder, or</span>
          <SubmitButton variant="outline" size="sm" pendingText="Sending…">
            Send a new code
          </SubmitButton>
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Wrong account?{" "}
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void logout()}>
          Log out
        </Button>
      </p>
    </div>
  );
}
