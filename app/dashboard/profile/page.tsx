import type { Metadata } from "next";
import { AvatarUpload, PasswordForm, ProfileForm } from "@/app/dashboard/profile/profile-forms";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navigation } from "@/lib/navigation";
import { roleLabels } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

/** Shared by every role, so it renders that role's dashboard navigation. */
export default async function ProfilePage() {
  const user = await requireUser();
  const nav = navigation[user.role];

  return (
    <DashboardShell title={nav.title} subtitle={user.name} nav={nav.items}>
      <PageHeader title="Profile & settings" description={`${roleLabels[user.role]} account · ${user.email}`} />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUpload name={user.name} avatarUrl={user.avatarUrl} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
            <CardDescription>Your email address is your login and can&apos;t be changed here.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={{ name: user.name, phone: user.phone, emailNotifications: user.emailNotifications }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
