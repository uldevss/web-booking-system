"use client";

import { Loader2 } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

// Small building blocks for server-action forms: labelled inputs that show the
// field's error from FormState, a banner for form-level messages, and a submit
// button that shows progress.

type FieldProps = {
  name: string;
  label: string;
  state?: FormState;
  hint?: ReactNode;
  className?: string;
};

export function TextField({
  name,
  label,
  state,
  hint,
  className,
  defaultValue,
  ...input
}: FieldProps & Omit<ComponentProps<typeof Input>, "name">) {
  const error = state?.fields?.[name];
  const id = `field-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={state?.values?.[name] ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      <FieldNote id={id} error={error} hint={hint} />
    </div>
  );
}

/** Password input with a "Show password" checkbox underneath. */
export function PasswordField({
  name,
  label,
  state,
  hint,
  className,
  ...input
}: FieldProps & Omit<ComponentProps<typeof Input>, "name" | "type">) {
  const [visible, setVisible] = useState(false);
  const error = state?.fields?.[name];
  const id = `field-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      <FieldNote id={id} error={error} hint={hint} />
      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground select-none">
        <Checkbox checked={visible} onCheckedChange={(checked) => setVisible(checked === true)} />
        Show password
      </label>
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  state,
  hint,
  className,
  defaultValue,
  ...input
}: FieldProps & Omit<ComponentProps<typeof Textarea>, "name">) {
  const error = state?.fields?.[name];
  const id = `field-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        defaultValue={state?.values?.[name] ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      <FieldNote id={id} error={error} hint={hint} />
    </div>
  );
}

export function FieldNote({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">
      {hint}
    </p>
  ) : null;
}

/** Form-level error or success banner. */
export function FormMessage({ state }: { state?: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
        {state.success}
      </p>
    );
  }
  return null;
}

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
