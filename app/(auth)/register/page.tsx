import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/app/(auth)/auth-forms";
import { GoogleButton } from "@/app/(auth)/google-button";
import { googleEnabled } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/forms";
import { homePathFor } from "@/lib/roles";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const callbackUrl = safeRedirectPath(flattenParams(await searchParams).callbackUrl) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl ?? homePathFor(user.role));
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Book stays, tours, tables and venues and keep track of them in one place.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {googleEnabled ? <GoogleButton callbackUrl={callbackUrl} label="Sign up with Google" /> : null}
          <RegisterForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Run a hotel, rental, tour, venue or restaurant?{" "}
        <Link href="/provider/register" className="font-medium text-primary hover:underline">
          Register your business
        </Link>
      </p>
    </div>
  );
}
