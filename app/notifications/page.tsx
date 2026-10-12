import type { Metadata } from "next";
import Link from "next/link";
import { MarkAllRead } from "@/app/notifications/mark-all-read";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { navigation } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const nav = navigation[user.role];
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((note) => !note.isRead).length;

  return (
    <DashboardShell title={nav.title} subtitle={user.name} nav={nav.items}>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread ? <MarkAllRead /> : null}
      />
      {notifications.length ? (
        <ul className="divide-y rounded-lg border">
          {notifications.map((note) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium">{note.title}</p>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={note.createdAt.toISOString()}>
                    {formatDateTime(note.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{note.message}</p>
              </>
            );
            return (
              <li key={note.id} className={cn(!note.isRead && "bg-primary/5")}>
                {note.link ? (
                  <Link href={note.link} className="block px-4 py-3 hover:bg-muted/50">
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No notifications yet" description="Booking updates and reminders will show up here." />
      )}
    </DashboardShell>
  );
}
