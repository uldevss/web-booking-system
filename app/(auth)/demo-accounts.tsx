"use client";

import { useState } from "react";
import { CategoryGlyph } from "@/components/category";
import type { BusinessCategory } from "@/lib/generated/prisma/enums";

export type DemoAccount = {
  email: string;
  label: string;
  category?: BusinessCategory;
};

/**
 * Development only: one-click sign-in for the seeded demo accounts, so every
 * business type can be tried without remembering which owner runs which.
 */
export function DemoAccounts({ accounts, password }: { accounts: DemoAccount[]; password: string }) {
  const [open, setOpen] = useState(false);

  function fill(email: string) {
    const emailField = document.getElementById("field-email") as HTMLInputElement | null;
    const passwordField = document.getElementById("field-password") as HTMLInputElement | null;
    if (emailField) emailField.value = email;
    if (passwordField) passwordField.value = password;
    emailField?.form?.requestSubmit();
  }

  return (
    <div className="mt-6 rounded-lg border border-dashed p-4 text-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full text-left font-medium" aria-expanded={open}>
        Demo accounts {open ? "▾" : "▸"}
      </button>
      {open ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Local demo data only. Click an account to sign in as it (password: <code>{password}</code>).
          </p>
          <ul className="mt-3 grid gap-1">
            {accounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => fill(account.email)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  {account.category ? <CategoryGlyph category={account.category} className="text-muted-foreground" /> : <span className="size-4" />}
                  <span className="font-medium">{account.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
