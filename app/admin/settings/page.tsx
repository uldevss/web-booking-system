import type { Metadata } from "next";
import { PaymentSettingsForm, QrUpload } from "@/app/admin/settings/settings-forms";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformSettings } from "@/lib/platform";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Payment settings" };

export default async function AdminSettingsPage() {
  await requireUser(["ADMIN"]);
  const settings = await getPlatformSettings();

  return (
    <>
      <PageHeader
        title="Payment settings"
        description="Guests pay every deposit and full payment to this GCash account. The platform keeps the commission and passes the rest to the business."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GCash account & commission</CardTitle>
            <CardDescription>Shown to guests at checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentSettingsForm
              settings={{
                gcashName: settings.gcashName,
                gcashNumber: settings.gcashNumber,
                commissionPercent: settings.commissionPercent.toString(),
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GCash QR code</CardTitle>
            <CardDescription>Guests scan this in the GCash app to pay.</CardDescription>
          </CardHeader>
          <CardContent>
            <QrUpload qrUrl={settings.gcashQrUrl} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
