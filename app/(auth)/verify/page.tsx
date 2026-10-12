import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/app/(auth)/verify/verify-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/forms";
import { homePathFor } from "@/lib/roles";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/session";
import { CODE_TTL_MINUTES, codesGoToConsole } from "@/lib/verification";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const callbackUrl = safeRedirectPath(flattenParams(await searchParams).callbackUrl) ?? undefined;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent("/verify")}`);
  if (user.emailVerifiedAt) redirect(callbackUrl ?? homePathFor(user.role));
  const devOnly = process.env.NODE_ENV !== "production" && codesGoToConsole();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <MailCheck aria-hidden className="mb-2 size-8 text-primary" />
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We sent a 6-digit code to <span className="font-medium text-foreground">{user.email}</span>. Enter it below to
            finish creating your account. The code works for {CODE_TTL_MINUTES} minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devOnly ? (
            <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              Development: email sending isn&apos;t configured, so the code was printed in the terminal running{" "}
              <code>npm run dev</code>. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env to send real emails.
            </p>
          ) : null}
          <VerifyForm callbackUrl={callbackUrl} />
          <p className="mt-4 text-xs text-muted-foreground">
            Can&apos;t find it? Check your <strong>Spam</strong> folder first: the email is from {process.env.GMAIL_USER || "our sender"} with
            the subject &quot;confirm your {process.env.NEXT_PUBLIC_APP_NAME || "Booking System"} account&quot;. Marking it
            &quot;Not spam&quot; makes future booking updates land in your inbox.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            No email after a few minutes, even in spam? Then this Gmail address probably doesn&apos;t exist or was mistyped.
            Log out and sign up again with the correct address, or use &quot;Continue with Google&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
