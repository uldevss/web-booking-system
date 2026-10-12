import { NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/reminders: run daily by Vercel Cron (see vercel.json).
 * Vercel sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyReminders();
  // Housekeeping: drop expired rate-limit windows.
  const { count: expiredLimits } = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });

  return NextResponse.json({ ...result, expiredLimits });
}
