import type { z } from "zod";
import { AppError } from "./errors";

// Conventions for server-action forms used with React's useActionState.
// Kept free of heavy imports: client components import the helpers below.

export type FormState =
  | {
      /** Banner message for the whole form */
      error?: string;
      /** Success message */
      success?: string;
      /** Per-field messages */
      fields?: Record<string, string>;
      /** Submitted values, so inputs keep what the user typed after an error */
      values?: Record<string, string>;
    }
  | undefined;

const SECRET_FIELDS = ["password", "currentPassword", "newPassword", "confirmPassword"];

/**
 * Text values of a form submission, minus secrets. Repeated keys (checkbox
 * groups) are joined with commas; read them back with `checkedValues`.
 */
export function formValues(formData: FormData, omit: string[] = SECRET_FIELDS) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || omit.includes(key) || key.startsWith("$")) continue;
    values[key] = key in values ? `${values[key]},${value}` : value;
  }
  return values;
}

/** Which boxes of a checkbox group to tick: the submitted ones after an error, else the saved ones. */
export function checkedValues(state: FormState, name: string, saved: string[]): Set<string> {
  if (!state?.values) return new Set(saved);
  return new Set(state.values[name]?.split(",").filter(Boolean) ?? []);
}

/** A single checkbox: submitted state after an error, else the saved value. */
export function isChecked(state: FormState, name: string, saved: boolean): boolean {
  return state?.values ? state.values[name] === "on" : saved;
}

/** First error message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    result[key] ??= issue.message;
  }
  return result;
}

/** Turns a failed Zod parse into form state. */
export function invalid(error: z.ZodError, formData: FormData): FormState {
  const fields = fieldErrors(error);
  return { error: fields.form, fields, values: formValues(formData) };
}

/** Turns an expected AppError into form state; rethrows anything else (including redirects). */
export function failed(error: unknown, formData?: FormData): FormState {
  if (error instanceof AppError) return { error: error.message, values: formData ? formValues(formData) : undefined };
  throw error;
}

/**
 * Post-login destination, reduced to a same-site path. Absolute URLs (Auth.js
 * sends those) keep only their path, so a crafted link can't redirect off-site.
 */
export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value) return null;
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  return path;
}
