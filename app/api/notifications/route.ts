import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/session";
import { markNotificationsSchema } from "@/lib/validators";

/** GET /api/notifications: latest notifications and the unread count. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, title: true, message: true, link: true, isRead: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
});

/** PATCH /api/notifications with { all: true } or { ids: [...] }: mark as read. */
export const PATCH = handle(async (request: Request) => {
  const user = await requireApiUser();
  const input = markNotificationsSchema.parse(await readJson(request));
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false, ...("ids" in input ? { id: { in: input.ids } } : {}) },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
});
