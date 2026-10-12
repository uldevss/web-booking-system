"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, registerProvider } from "@/app/(auth)/actions";
import { CategorySelect } from "@/components/category-select";
import { FormMessage, PasswordField, SubmitButton, TextAreaField, TextField } from "@/components/form-fields";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <FormMessage state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <PasswordField name="password" label="Password" autoComplete="current-password" required state={state} />
      <SubmitButton className="w-full" pendingText="Signing in…">
        Log in
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="grid gap-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <FormMessage state={state} />
      <TextField name="name" label="Full name" autoComplete="name" required state={state} />
      <TextField
        name="email"
        label="Gmail address"
        type="email"
        autoComplete="email"
        required
        hint="We'll email you a 6-digit code to confirm it's yours."
        state={state}
      />
      <TextField name="phone" label="Mobile number (optional)" type="tel" autoComplete="tel" state={state} />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        state={state}
      />
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ProviderRegisterForm() {
  const [state, action] = useActionState(registerProvider, undefined);
  return (
    <form action={action} className="grid gap-6">
      <FormMessage state={state} />
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-semibold">Your business</legend>
        <TextField name="businessName" label="Business name" required state={state} />
        <CategorySelect state={state} hint="Hotel, short-term rental, tour operator, escape room, event venue or restaurant." />
        <TextField name="address" label="Address" autoComplete="street-address" state={state} />
        <TextAreaField name="description" label="Short description" rows={3} state={state} hint="Shown on your public page." />
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-semibold">Owner account</legend>
        <TextField name="name" label="Your full name" autoComplete="name" required state={state} />
        <TextField
          name="email"
          label="Gmail address"
          type="email"
          autoComplete="email"
          required
          hint="We'll email you a 6-digit code to confirm it's yours."
          state={state}
        />
        <TextField name="phone" label="Mobile number (optional)" type="tel" autoComplete="tel" state={state} />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          state={state}
        />
      </fieldset>
      <SubmitButton className="w-full" pendingText="Submitting…">
        Register business
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        An admin reviews new businesses before they appear in search. You can set up rooms, tables, spaces, staff and
        booking options right away.
      </p>
    </form>
  );
}
