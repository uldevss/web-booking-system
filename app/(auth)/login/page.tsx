import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/(auth)/auth-forms";
import { DemoAccounts, type DemoAccount } from "@/app/(auth)/demo-accounts";
import { GoogleButton } from "@/app/(auth)/google-button";
import { googleEnabled } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel } from "@/lib/catalog";
import { safeRedirectPath } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { homePathFor } from "@/lib/roles";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

/** The seeded demo logins (see prisma/seed.ts), shown only outside production. */
async function demoAccounts(): Promise<DemoAccount[]> {
  if (process.env.NODE_ENV === "production") return [];
  const admin = await prisma.user.findUnique({ where: { email: "admin@example.com" }, select: { id: true } });
  if (!admin) return [];
  const businesses = await prisma.provider.findMany({
    where: { owner: { email: { endsWith: "@example.com" } } },
    select: { businessName: true, category: true, isApproved: true, owner: { select: { email: true } } },
    orderBy: { businessName: "asc" },
  });
  return [
    { email: "customer@example.com", label: "Guest" },
    ...businesses.map((b) => ({
      email: b.owner.email,
      label: `${b.businessName} (${categoryLabel(b.category)}${b.isApproved ? "" : ", awaiting approval"})`,
      category: b.category,
    })),
    { email: "employee@example.com", label: "Staff: Harbor View Hotel concierge" },
    { email: "admin@example.com", label: "Admin" },
  ];
}

/** Messages for the ?error= Auth.js adds when a Google sign-in fails. */
const oauthErrors: Record<string, string> = {
  AccessDenied: "That Google account can't be used here. Sign-ups need an allowed email address, and suspended accounts can't sign in.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
  Configuration: "Google sign-in isn't set up correctly. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = flattenParams(await searchParams);
  const callbackUrl = safeRedirectPath(params.callbackUrl) ?? undefined;
  // Checked against the database: a stale session token shows the form instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl ?? homePathFor(user.role));
  const demo = await demoAccounts();
  const oauthError = params.error ? (oauthErrors[params.error] ?? "Google sign-in didn't work. Please try again.") : null;
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Log in to manage your bookings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {oauthError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {oauthError}
            </p>
          ) : null}
          {googleEnabled ? <GoogleButton callbackUrl={callbackUrl} /> : null}
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
      {demo.length ? <DemoAccounts accounts={demo} password="Password123!" /> : null}
    </div>
  );
}
