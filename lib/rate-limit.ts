import "server-only";
import { prisma } from "./prisma";

// Fixed-window rate limiting stored in Postgres, so limits hold across
// serverless instances without extra infrastructure. One atomic upsert per
// check: the counter resets when its window has expired.

/**
 * Limits are off while developing (no cap on sign-ups, logins, codes) unless
 * RATE_LIMIT=on; in production they are always on unless RATE_LIMIT=off.
 */
export function rateLimitEnabled() {
  const setting = process.env.RATE_LIMIT?.toLowerCase();
  if (setting === "off") return false;
  if (setting === "on") return true;
  return process.env.NODE_ENV === "production";
}

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  if (!rateLimitEnabled()) return { ok: true, retryAfterSeconds: 0 };
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, timezone('UTC', now()) + make_interval(secs => ${windowSeconds}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= timezone('UTC', now()) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= timezone('UTC', now())
        THEN timezone('UTC', now()) + make_interval(secs => ${windowSeconds}::int)
        ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
  return { ok: Number(count) <= limit, retryAfterSeconds };
}

/** Best-effort client IP behind Vercel or another proxy. */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export function retryMessage(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
