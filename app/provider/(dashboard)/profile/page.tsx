import type { Metadata } from "next";
import Link from "next/link";
import { BusinessProfileForm } from "@/app/provider/(dashboard)/profile/business-profile-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Business profile" };

export default async function BusinessProfilePage() {
  const { provider } = await requireProvider();
  return (
    <>
      <PageHeader
        title="Business profile"
        description={
          <>
            Shown on your{" "}
            <Link href={`/providers/${provider.id}`} className="text-primary hover:underline">
              public page
            </Link>
            .
          </>
        }
      />
      <Card className="max-w-2xl">
        <CardContent>
          <BusinessProfileForm
            provider={{
              businessName: provider.businessName,
              category: provider.category,
              address: provider.address,
              description: provider.description,
            }}
            depositPercent={siteConfig.depositPercent}
          />
        </CardContent>
      </Card>
    </>
  );
}
