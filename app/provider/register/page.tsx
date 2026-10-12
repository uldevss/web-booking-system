import type { Metadata } from "next";
import Link from "next/link";
import { ProviderRegisterForm } from "@/app/(auth)/auth-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homePathFor } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Register your business" };

export default async function ProviderRegisterPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">List your business</CardTitle>
          <CardDescription>
            For hotels, short-term rentals, tour operators, escape rooms, event venues and restaurants. Take bookings
            online, manage rooms, tables, spaces and staff, and track payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="grid gap-4 text-sm">
              <p>
                You&apos;re signed in as <span className="font-medium">{user.email}</span>. A business needs its own owner account,
                so log out first to register one.
              </p>
              <Button asChild variant="outline">
                <Link href={homePathFor(user.role)}>Back to my dashboard</Link>
              </Button>
            </div>
          ) : (
            <ProviderRegisterForm />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
